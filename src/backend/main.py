"""
Backend FastAPI – Cadastro e Validação de Biometria Facial
=========================================================
Dependências:
    pip install fastapi uvicorn face_recognition opencv-python-headless numpy pillow

Executar:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import pickle
import base64
import io
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
import face_recognition
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Inicialização ───────────────────────────────────────────────
app = FastAPI(
    title="PontoAI – Biometria Facial",
    description="API para cadastro e validação de rostos de colaboradores.",
    version="1.0.0",
)

# CORS – permitir chamadas do front‑end Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # Em produção, restrinja ao domínio real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminho do banco de rostos local
DB_PATH = os.path.join(os.path.dirname(__file__), "faces_db.pkl")


# ── Helpers ─────────────────────────────────────────────────────
def _load_db() -> list[dict]:
    """Carrega o banco de rostos do arquivo .pkl."""
    if os.path.exists(DB_PATH):
        with open(DB_PATH, "rb") as f:
            return pickle.load(f)
    return []


def _save_db(db: list[dict]) -> None:
    """Salva o banco de rostos no arquivo .pkl."""
    with open(DB_PATH, "wb") as f:
        pickle.dump(db, f)


def _decode_image(base64_str: str) -> np.ndarray:
    """Converte base64 (com ou sem header data:image/...) em numpy array RGB."""
    # Remove o header data:image/xxx;base64, se existir
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]

    img_bytes = base64.b64decode(base64_str)
    pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(pil_image)


# ── Schemas ─────────────────────────────────────────────────────
class CadastroFaceRequest(BaseModel):
    nome: str
    cpf: str
    cargo: Optional[str] = None
    imagem_base64: str


class ValidarFaceRequest(BaseModel):
    imagem_base64: str


# ── Rotas ───────────────────────────────────────────────────────
@app.get("/")
def health_check():
    db = _load_db()
    return {
        "status": "online",
        "rostos_cadastrados": len(db),
        "mensagem": "PontoAI Biometria Facial API",
    }


@app.post("/cadastrar_face")
def cadastrar_face(payload: CadastroFaceRequest):
    """
    Recebe imagem base64, extrai o embedding facial e salva no banco local .pkl.
    """
    # 1. Decodificar imagem
    try:
        img_rgb = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    # 2. Localizar rostos na imagem
    face_locations = face_recognition.face_locations(img_rgb, model="hog")

    if len(face_locations) == 0:
        raise HTTPException(
            status_code=422,
            detail="Nenhum rosto detectado na imagem. Tire uma foto com boa iluminação e o rosto bem visível.",
        )

    if len(face_locations) > 1:
        raise HTTPException(
            status_code=422,
            detail=f"Detectados {len(face_locations)} rostos. Envie uma foto com apenas 1 pessoa.",
        )

    # 3. Extrair encoding (embedding de 128 dimensões)
    encodings = face_recognition.face_encodings(img_rgb, known_face_locations=face_locations)

    if len(encodings) == 0:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair os pontos faciais. Tente novamente com outra foto.",
        )

    face_encoding = encodings[0]

    # 4. Verificar se já existe cadastro com mesmo CPF
    db = _load_db()
    for i, registro in enumerate(db):
        if registro["cpf"] == payload.cpf:
            # Atualizar registro existente
            db[i] = {
                "nome": payload.nome,
                "cpf": payload.cpf,
                "cargo": payload.cargo,
                "encoding": face_encoding.tolist(),
                "data_cadastro": datetime.now().isoformat(),
            }
            _save_db(db)
            return {
                "sucesso": True,
                "mensagem": f"✅ Biometria de '{payload.nome}' atualizada com sucesso!",
                "cpf": payload.cpf,
                "atualizado": True,
            }

    # 5. Salvar novo registro
    novo_registro = {
        "nome": payload.nome,
        "cpf": payload.cpf,
        "cargo": payload.cargo,
        "encoding": face_encoding.tolist(),
        "data_cadastro": datetime.now().isoformat(),
    }

    db.append(novo_registro)
    _save_db(db)

    return {
        "sucesso": True,
        "mensagem": f"✅ Rosto de '{payload.nome}' cadastrado com sucesso!",
        "cpf": payload.cpf,
        "total_cadastrados": len(db),
    }


@app.post("/validar_assinatura_facial")
def validar_assinatura_facial(payload: ValidarFaceRequest):
    """
    Recebe imagem base64, extrai o encoding e compara com todos os
    rostos cadastrados no banco .pkl. Retorna o nome da pessoa se houver match.
    """
    # 1. Decodificar imagem
    try:
        img_rgb = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    # 2. Localizar e encodar rosto
    face_locations = face_recognition.face_locations(img_rgb, model="hog")

    if len(face_locations) == 0:
        raise HTTPException(
            status_code=422,
            detail="Nenhum rosto detectado na imagem enviada.",
        )

    encodings = face_recognition.face_encodings(img_rgb, known_face_locations=face_locations)

    if len(encodings) == 0:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair os pontos faciais.",
        )

    face_encoding = encodings[0]

    # 3. Carregar banco de rostos
    db = _load_db()

    if len(db) == 0:
        raise HTTPException(
            status_code=404,
            detail="Nenhum rosto cadastrado no banco. Cadastre colaboradores primeiro.",
        )

    # 4. Comparar com todos os rostos cadastrados
    known_encodings = [np.array(r["encoding"]) for r in db]
    known_names = [r["nome"] for r in db]
    known_cpfs = [r["cpf"] for r in db]

    # face_distance retorna a distância euclidiana (quanto menor, mais parecido)
    distances = face_recognition.face_distance(known_encodings, face_encoding)
    best_match_idx = int(np.argmin(distances))
    best_distance = float(distances[best_match_idx])

    # Tolerância padrão: 0.6 (menor = mais restrito)
    TOLERANCE = 0.6

    if best_distance <= TOLERANCE:
        return {
            "match": True,
            "nome": known_names[best_match_idx],
            "cpf": known_cpfs[best_match_idx],
            "confianca": round((1 - best_distance) * 100, 1),
            "distancia": round(best_distance, 4),
        }
    else:
        return {
            "match": False,
            "nome": None,
            "mensagem": "Rosto não reconhecido. O colaborador pode não estar cadastrado.",
            "melhor_distancia": round(best_distance, 4),
        }


@app.get("/listar_cadastros")
def listar_cadastros():
    """Lista todos os colaboradores cadastrados (sem os encodings, por performance)."""
    db = _load_db()
    return {
        "total": len(db),
        "cadastros": [
            {
                "nome": r["nome"],
                "cpf": r["cpf"],
                "cargo": r.get("cargo"),
                "data_cadastro": r.get("data_cadastro"),
            }
            for r in db
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
Backend FastAPI – Cadastro e Validação de Biometria Facial
=========================================================
Dependências:
    pip install fastapi uvicorn face_recognition opencv-python-headless numpy pillow supabase python-dotenv

Executar:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import json
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
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ── Inicialização Supabase ──────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("AVISO: Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY não encontradas no arquivo .env.")

try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        supabase = None
except Exception as e:
    supabase = None
    print(f"Erro ao inicializar Supabase: {e}")


# ── Inicialização FastAPI ───────────────────────────────────────
app = FastAPI(
    title="PontoAI – Biometria Facial com Supabase",
    description="API para cadastro e validação de rostos de colaboradores.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ─────────────────────────────────────────────────────

def _decode_image(base64_str: str) -> np.ndarray:
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
    if not supabase:
        return {"status": "offline", "mensagem": "Supabase não configurado. Verifique o .env"}
    
    try:
        response = supabase.table("colaboradores").select("id", count="exact").execute()
        total = response.count
    except Exception as e:
        total = 0
        print(f"Erro ao contar colaboradores: {e}")

    return {
        "status": "online",
        "rostos_cadastrados": total,
        "mensagem": "PontoAI Biometria Facial API com Supabase",
    }

@app.post("/cadastrar_face")
def cadastrar_face(payload: CadastroFaceRequest):
    if not supabase:
         raise HTTPException(status_code=500, detail="Supabase não configurado.")

    try:
        img_rgb = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    face_locations = face_recognition.face_locations(img_rgb, model="hog")

    if len(face_locations) == 0:
        raise HTTPException(status_code=422, detail="Nenhum rosto detectado na imagem. Tire uma foto com boa iluminação e o rosto bem visível.")
    if len(face_locations) > 1:
        raise HTTPException(status_code=422, detail=f"Detectados {len(face_locations)} rostos. Envie uma foto com apenas 1 pessoa.")

    encodings = face_recognition.face_encodings(img_rgb, known_face_locations=face_locations)

    if len(encodings) == 0:
        raise HTTPException(status_code=422, detail="Não foi possível extrair os pontos faciais. Tente novamente com outra foto.")

    face_encoding = encodings[0]
    
    # Supabase operations
    # Ver se cpf ja existe
    existing = supabase.table("colaboradores").select("*").eq("cpf", payload.cpf).execute()

    registro = {
        "nome": payload.nome,
        "cpf": payload.cpf,
        "cargo": payload.cargo,
        "encoding": json.dumps(face_encoding.tolist()),  # Save as JSON string
    }

    if existing.data and len(existing.data) > 0:
        # Atualizar
        try:
             supabase.table("colaboradores").update(registro).eq("cpf", payload.cpf).execute()
             return {
                 "sucesso": True,
                 "mensagem": f"✅ Biometria de '{payload.nome}' atualizada com sucesso!",
                 "cpf": payload.cpf,
                 "atualizado": True,
             }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao atualizar no Supabase: {str(e)}")
    else:
        # Inserir
        try:
            supabase.table("colaboradores").insert(registro).execute()
            return {
                "sucesso": True,
                "mensagem": f"✅ Rosto de '{payload.nome}' cadastrado com sucesso no Supabase!",
                "cpf": payload.cpf,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao inserir no Supabase: {str(e)}")


@app.post("/validar_assinatura_facial")
def validar_assinatura_facial(payload: ValidarFaceRequest):
    if not supabase:
         raise HTTPException(status_code=500, detail="Supabase não configurado.")

    try:
        img_rgb = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    face_locations = face_recognition.face_locations(img_rgb, model="hog")

    if len(face_locations) == 0:
        raise HTTPException(status_code=422, detail="Nenhum rosto detectado na imagem enviada.")

    encodings = face_recognition.face_encodings(img_rgb, known_face_locations=face_locations)

    if len(encodings) == 0:
        raise HTTPException(status_code=422, detail="Não foi possível extrair os pontos faciais.")

    face_encoding = encodings[0]

    # Carregar banco de rostos do supabase
    response = supabase.table("colaboradores").select("nome, cpf, encoding").execute()
    db = response.data

    if not db or len(db) == 0:
        raise HTTPException(status_code=404, detail="Nenhum rosto cadastrado no banco. Cadastre colaboradores primeiro.")

    known_encodings = []
    known_names = []
    known_cpfs = []

    for r in db:
        if r.get("encoding"):
            try:
                enc = np.array(json.loads(r["encoding"]))
                known_encodings.append(enc)
                known_names.append(r["nome"])
                known_cpfs.append(r["cpf"])
            except Exception as e:
                print(f"Erro ao fazer parse do encoding para {r['nome']}: {e}")

    if not known_encodings:
         raise HTTPException(status_code=500, detail="Nenhum encoding válido encontrado no banco.")

    distances = face_recognition.face_distance(known_encodings, face_encoding)
    best_match_idx = int(np.argmin(distances))
    best_distance = float(distances[best_match_idx])

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
            "mensagem": "Rosto não reconhecido. O colaborador não está cadastrado ou a foto está diferente.",
            "melhor_distancia": round(best_distance, 4),
        }

@app.get("/listar_cadastros")
def listar_cadastros():
    if not supabase:
         raise HTTPException(status_code=500, detail="Supabase não configurado.")

    response = supabase.table("colaboradores").select("nome, cpf, cargo").execute() # Note: removemos created_at caso n exista. Melhor: apenas pegar o que sabemos q vai ter
    db = response.data
    return {
        "total": len(db) if db else 0,
        "cadastros": db if db else [],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

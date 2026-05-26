"""
Backend FastAPI – Cadastro e Validação de Biometria Facial
=========================================================
Usa MediaPipe Tasks API (FaceLandmarker) para gerar embeddings faciais.
Não depende de dlib, cmake ou compilação C++.

Dependências:
    pip install fastapi uvicorn mediapipe opencv-contrib-python numpy pillow supabase python-dotenv

Executar:
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import json
import base64
import io
import urllib.request
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
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
    print("⚠️  AVISO: Variáveis SUPABASE_URL e SUPABASE_KEY não encontradas no .env")

try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        supabase = None
except Exception as e:
    supabase = None
    print(f"Erro ao inicializar Supabase: {e}")


# ── Inicialização MediaPipe ─────────────────────────────────────
MODEL_PATH = "face_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"

if not os.path.exists(MODEL_PATH):
    print(f"Baixando modelo MediaPipe Face Landmarker ({MODEL_PATH})...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Download do modelo concluído.")
    except Exception as e:
        print(f"Erro ao baixar o modelo: {e}")

try:
    base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    detector = vision.FaceLandmarker.create_from_options(options)
except Exception as e:
    print(f"Aviso: MediaPipe FaceLandmarker falhou ao inicializar: {e}")
    detector = None

# ── Inicialização FastAPI ───────────────────────────────────────
app = FastAPI(
    title="PontoAI – Biometria Facial com MediaPipe + Supabase",
    description="API para cadastro e validação de rostos de colaboradores.",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ─────────────────────────────────────────────────────

def _decode_image(base64_str: str) -> mp.Image:
    """Decodifica uma imagem base64 para um objeto mediapipe.Image."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]

    img_bytes = base64.b64decode(base64_str)
    pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    numpy_image = np.array(pil_image)
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=numpy_image)


def _extract_face_encoding(mp_image: mp.Image) -> Optional[list]:
    """
    Extrai um encoding facial usando MediaPipe FaceLandmarker.
    Retorna uma lista de coordenadas normalizadas dos 478 landmarks.
    Os landmarks são normalizados relativamente ao bounding box do rosto
    para serem invariantes a posição e escala.
    """
    if not detector:
        return None
        
    detection_result = detector.detect(mp_image)

    if not detection_result.face_landmarks:
        return None

    face_landmarks = detection_result.face_landmarks[0]

    # Extrair coordenadas x, y, z de cada landmark
    raw_points = []
    for lm in face_landmarks:
        raw_points.append([lm.x, lm.y, lm.z])

    points = np.array(raw_points)

    # Normalizar: centralizar e escalar pelo bounding box
    min_vals = points.min(axis=0)
    max_vals = points.max(axis=0)
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1  # evitar divisão por zero

    normalized = (points - min_vals) / range_vals

    return normalized.flatten().tolist()


def _face_distance(encoding1: list, encoding2: list) -> float:
    """
    Calcula a distância euclidiana normalizada entre dois encodings faciais.
    Quanto menor, mais parecidos são os rostos.
    """
    a = np.array(encoding1)
    b = np.array(encoding2)

    # Se os encodings têm tamanhos diferentes, usar o menor
    min_len = min(len(a), len(b))
    a = a[:min_len]
    b = b[:min_len]

    distance = np.linalg.norm(a - b) / np.sqrt(min_len)
    return float(distance)


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

    if not detector:
        return {"status": "offline", "mensagem": "MediaPipe FaceLandmarker não carregado."}

    try:
        response = supabase.table("colaboradores").select("id", count="exact").execute()
        total = response.count
    except Exception as e:
        total = 0
        print(f"Erro ao contar colaboradores: {e}")

    return {
        "status": "online",
        "rostos_cadastrados": total,
        "mensagem": "PontoAI Biometria Facial API v2 (MediaPipe + Supabase)",
    }


@app.post("/cadastrar_face")
def cadastrar_face(payload: CadastroFaceRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase não configurado.")

    try:
        mp_image = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    if not detector:
         raise HTTPException(status_code=500, detail="Módulo de reconhecimento facial não carregado.")

    # Extrair encoding facial (já detecta e extrai landmarks)
    encoding = _extract_face_encoding(mp_image)

    if encoding is None:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível detectar o rosto ou extrair os pontos faciais. Tente uma foto melhor."
        )

    # Supabase: verificar se cpf já existe
    existing = supabase.table("colaboradores").select("*").eq("cpf", payload.cpf).execute()

    registro = {
        "nome": payload.nome,
        "cpf": payload.cpf,
        "cargo": payload.cargo,
        "encoding": json.dumps(encoding),
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
                "mensagem": f"✅ Rosto de '{payload.nome}' cadastrado com sucesso!",
                "cpf": payload.cpf,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao inserir no Supabase: {str(e)}")


@app.post("/validar_assinatura_facial")
def validar_assinatura_facial(payload: ValidarFaceRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase não configurado.")
    if not detector:
         raise HTTPException(status_code=500, detail="Módulo de reconhecimento facial não carregado.")

    try:
        mp_image = _decode_image(payload.imagem_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

    # Extrair encoding
    encoding = _extract_face_encoding(mp_image)

    if encoding is None:
        raise HTTPException(status_code=422, detail="Nenhum rosto detectado na imagem enviada.")

    # Carregar banco de rostos do Supabase
    response = supabase.table("colaboradores").select("nome, cpf, encoding").execute()
    db = response.data

    if not db or len(db) == 0:
        raise HTTPException(
            status_code=404,
            detail="Nenhum rosto cadastrado no banco. Cadastre colaboradores primeiro."
        )

    best_distance = float("inf")
    best_match_idx = -1
    valid_entries = []

    for i, r in enumerate(db):
        if r.get("encoding"):
            try:
                stored_encoding = json.loads(r["encoding"])
                dist = _face_distance(encoding, stored_encoding)
                valid_entries.append({"nome": r["nome"], "cpf": r["cpf"], "distance": dist})
                if dist < best_distance:
                    best_distance = dist
                    best_match_idx = len(valid_entries) - 1
            except Exception as e:
                print(f"Erro ao processar encoding de {r['nome']}: {e}")

    if not valid_entries:
        raise HTTPException(status_code=500, detail="Nenhum encoding válido encontrado no banco.")

    # Limiar de tolerância para MediaPipe landmarks
    # Valores típicos para comparar landmarks normalizados variam
    TOLERANCE = 0.35

    if best_distance <= TOLERANCE:
        match = valid_entries[best_match_idx]
        return {
            "match": True,
            "nome": match["nome"],
            "cpf": match["cpf"],
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

    response = supabase.table("colaboradores").select("nome, cpf, cargo").execute()
    db = response.data
    return {
        "total": len(db) if db else 0,
        "cadastros": db if db else [],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

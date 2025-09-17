from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pathlib import Path
import shutil, uuid, sqlite3, mimetypes, os

from .db import get_conn

# ===========================
# Configuración
# ===========================
app = FastAPI(title="HumanPower API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

UPLOAD_DIR = Path(__file__).parent / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

ALLOWED_EXT = {".pdf", ".doc", ".docx"}

# Password de admin (podés moverlo a un .env si querés)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1234")

# ===========================
# Utilidad para proteger admin
# ===========================
def verify_admin(x_password: str = Header(None)):
    """
    Chequea header: X-Password
    """
    if x_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="No autorizado")
    return True

# ===========================
# Endpoints
# ===========================

@app.get("/")
def root():
    return {"ok": True, "service": "HumanPower API"}


# --- Subida de CV ---
@app.post("/cv")
async def upload_cv(
    full_name: str = Form(...),
    email: str = Form(...),
    message: str | None = Form(None),
    file: UploadFile = File(...)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Solo PDF/DOC/DOCX")

    # Guardar archivo en disco
    dest_name = f"cv-{uuid.uuid4().hex}{ext}"
    dest_path = UPLOAD_DIR / dest_name
    with dest_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    size = dest_path.stat().st_size
    mtype = file.content_type or mimetypes.guess_type(dest_path.name)[0] or "application/octet-stream"

    # Guardar metadatos en SQLite
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO resumes (full_name, email, message, filename, original_name, mimetype, size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (full_name, email, message, dest_name, file.filename, mtype, size))
    conn.commit()
    resume_id = cur.lastrowid
    conn.close()

    return {"resume_id": resume_id}


# --- Descarga directa de CV (conociendo el ID) ---
@app.get("/cv/{cv_id}")
def download_cv(cv_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT filename, original_name FROM resumes WHERE id = ?", (cv_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No encontrado")

    file_path = UPLOAD_DIR / row[0]
    if not file_path.exists():
        raise HTTPException(status_code=410, detail="Archivo no disponible")

    return FileResponse(path=file_path, filename=row[1], media_type="application/octet-stream")


# --- ADMIN: Lista todos los CVs ---
@app.get("/admin/cv", dependencies=[Depends(verify_admin)])
def list_cvs_admin():
    """
    Lista de CVs (solo con password correcto)
    Header requerido: X-Password
    """
    conn = get_conn()
    cur = conn.cursor()
    # 👇 Agregamos 'message'
    cur.execute("""
        SELECT id, full_name, email, original_name, message, created_at
        FROM resumes
        ORDER BY id DESC
    """)
    rows = [
        {
            "id": r[0],
            "full_name": r[1],
            "email": r[2],
            "original_name": r[3],
            "message": r[4] or "",
            "created_at": r[5],
        }
        for r in cur.fetchall()
    ]
    conn.close()
    return {"items": rows}

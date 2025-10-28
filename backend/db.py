# backend/db.py
from pathlib import Path
import sqlite3

DB_PATH = Path(__file__).with_name("data.db")

def init_db():
    print("Inicializando la base de datos...")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name     TEXT NOT NULL,
            email         TEXT NOT NULL,
            message       TEXT,
            filename      TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mimetype      TEXT,
            size          INTEGER,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role          TEXT NOT NULL DEFAULT 'user',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_resumes_email ON resumes(email);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);")
    conn.commit()
    conn.close()
    print("Base de datos inicializada con éxito.")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# 👇 CAMBIO PRINCIPAL: Mueve la llamada a esta sección
if __name__ == "__main__":
    # Esto solo se ejecuta cuando corres el archivo directamente
    # con: python -m backend.db
    init_db()
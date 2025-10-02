# backend/db.py
from pathlib import Path
import sqlite3

DB_PATH = Path(__file__).with_name("data.db")

def init_db():
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
          mimetype      TEXT NOT NULL,
          size          INTEGER NOT NULL,
          created_at    TEXT DEFAULT (datetime('now'))
        );
    """)
    # <-- ESTA PARTE DEBE ESTAR
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT,
          email         TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role          TEXT DEFAULT 'user',
          created_at    TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_resumes_email ON resumes(email);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);")
    conn.commit()
    conn.close()

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # <— MUY IMPORTANTE
    return conn

init_db()

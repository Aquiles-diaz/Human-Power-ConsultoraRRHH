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
    conn.commit()
    conn.close()

def get_conn():
    return sqlite3.connect(DB_PATH)

# crear tabla al importar
init_db()

import os
import sqlite3
from werkzeug.security import generate_password_hash

# Resolve to <project_root>/instance/users.db regardless of where Python is invoked from
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCE_DIR  = os.path.join(_PROJECT_ROOT, "instance")
DB_FILE       = os.path.join(INSTANCE_DIR, "users.db")

# Auto-create instance/ folder if it doesn't exist
os.makedirs(INSTANCE_DIR, exist_ok=True)


def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        """)
        conn.commit()


def get_user(username):
    with sqlite3.connect(DB_FILE) as conn:
        row = conn.execute(
            "SELECT id, username, password FROM users WHERE username = ?", (username,)
        ).fetchone()
    if row:
        return {"id": row[0], "username": row[1], "password": row[2]}
    return None


def create_user(username, password):
    try:
        with sqlite3.connect(DB_FILE) as conn:
            conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (username, generate_password_hash(password))
            )
            conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False

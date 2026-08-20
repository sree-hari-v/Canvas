import sqlite3
import os
import json
import uuid
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "canvas_app.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS boards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                thumbnail TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Create a default board if table is empty
        cursor.execute("SELECT COUNT(*) as count FROM boards")
        row = cursor.fetchone()
        if row["count"] == 0:
            default_id = "default-board"
            now = datetime.now().isoformat()
            default_data = json.dumps({
                "version": "5.3.0",
                "objects": [
                    {
                        "type": "group",
                        "version": "5.3.0",
                        "originX": "center",
                        "originY": "center",
                        "left": 400,
                        "top": 300,
                        "width": 220,
                        "height": 220,
                        "fill": "",
                        "stroke": None,
                        "strokeWidth": 0,
                        "strokeDashArray": None,
                        "strokeLineCap": "butt",
                        "strokeDashOffset": 0,
                        "strokeLineJoin": "miter",
                        "strokeUniform": False,
                        "strokeMiterLimit": 4,
                        "scaleX": 1,
                        "scaleY": 1,
                        "angle": -2,
                        "flipX": False,
                        "flipY": False,
                        "opacity": 1,
                        "shadow": {
                            "color": "rgba(0,0,0,0.2)",
                            "blur": 15,
                            "offsetX": 5,
                            "offsetY": 8
                        },
                        "visible": True,
                        "backgroundColor": "",
                        "fillRule": "nonzero",
                        "paintFirst": "fill",
                        "globalCompositeOperation": "source-over",
                        "skewX": 0,
                        "skewY": 0,
                        "isStickyNote": True,
                        "noteColor": "#fef08a",
                        "objects": [
                            {
                                "type": "rect",
                                "version": "5.3.0",
                                "originX": "center",
                                "originY": "center",
                                "left": 0,
                                "top": 0,
                                "width": 220,
                                "height": 220,
                                "fill": "#fef08a",
                                "rx": 12,
                                "ry": 12,
                                "name": "bgRect"
                            },
                            {
                                "type": "i-text",
                                "version": "5.3.0",
                                "originX": "center",
                                "originY": "center",
                                "left": 0,
                                "top": 0,
                                "width": 180,
                                "height": 80,
                                "fill": "#1e293b",
                                "fontSize": 18,
                                "fontFamily": "Inter, sans-serif",
                                "text": "Welcome to your Infinite Canvas!\n\n• Drag objects around\n• Double click text to edit\n• Use the toolbar to draw",
                                "textAlign": "left",
                                "name": "textObj"
                            }
                        ]
                    }
                ]
            })
            cursor.execute(
                "INSERT INTO boards (id, name, data, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (default_id, "Untitled Whiteboard", default_data, "", now, now)
            )
        conn.commit()

def list_boards():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, created_at, updated_at, thumbnail FROM boards ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_board(board_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM boards WHERE id = ?", (board_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def create_board(name: str, data: str = None):
    board_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    if not data:
        data = json.dumps({"version": "5.3.0", "objects": []})
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO boards (id, name, data, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (board_id, name, data, "", now, now)
        )
        conn.commit()
    return get_board(board_id)

def update_board(board_id: str, name: str = None, data: str = None, thumbnail: str = None):
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if data is not None:
            updates.append("data = ?")
            params.append(data)
        if thumbnail is not None:
            updates.append("thumbnail = ?")
            params.append(thumbnail)
            
        updates.append("updated_at = ?")
        params.append(now)
        
        params.append(board_id)
        
        query = f"UPDATE boards SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    return get_board(board_id)

def delete_board(board_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM boards WHERE id = ?", (board_id,))
        conn.commit()
        return True

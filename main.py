from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import os
import database

app = FastAPI(title="CanvasLite", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Database on app startup
@app.on_event("startup")
def startup_event():
    database.init_db()

class BoardCreate(BaseModel):
    name: str
    data: Optional[str] = None

class BoardUpdate(BaseModel):
    name: Optional[str] = None
    data: Optional[str] = None
    thumbnail: Optional[str] = None

@app.get("/api/boards")
def get_boards():
    return database.list_boards()

@app.post("/api/boards")
def create_board(board: BoardCreate):
    new_board = database.create_board(board.name, board.data)
    return new_board

@app.get("/api/boards/{board_id}")
def get_board(board_id: str):
    board = database.get_board(board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

@app.put("/api/boards/{board_id}")
def update_board(board_id: str, board: BoardUpdate):
    existing = database.get_board(board_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Board not found")
    updated = database.update_board(
        board_id=board_id,
        name=board.name,
        data=board.data,
        thumbnail=board.thumbnail
    )
    return updated

@app.delete("/api/boards/{board_id}")
def delete_board(board_id: str):
    existing = database.get_board(board_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Board not found")
    database.delete_board(board_id)
    return {"message": "Board deleted successfully"}

@app.post("/api/boards/import")
async def import_board(file: UploadFile = File(...), name: Optional[str] = Form(None)):
    try:
        content = await file.read()
        json_data = json.loads(content.decode("utf-8"))
        board_name = name or os.path.splitext(file.filename)[0] or "Imported Board"
        
        # Format JSON data string
        data_str = json.dumps(json_data)
        new_board = database.create_board(board_name, data_str)
        return new_board
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file content: {str(e)}")

# Serve Static Files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
def read_root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>CanvasLite API Running</h1>"

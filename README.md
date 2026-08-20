# CanvasLite 🎨 — Online Infinite Whiteboard & Canvas

**CanvasLite** is a feature-rich, high-performance web-based infinite whiteboard and interactive canvas application built with **FastAPI**, **SQLite**, **Fabric.js**, and **Tailwind CSS**. It provides a fluid digital workspace for brainstorming, sketching, note-taking, diagramming, and organizing ideas.

---

## ✨ Features

### 🎨 Infinite Canvas & Navigation
- **Pan & Zoom Workspace**: Smooth infinite panning (`H` or hold `Space`) and continuous zoom (`+` / `-`, mouse wheel, or Fit Content button).
- **Multi-Canvas Tab System**: Open multiple whiteboard tabs simultaneously and switch between them effortlessly.
- **Glassmorphic UI**: Sleek, modern user interface with dark and light theme options and fullscreen mode.

### ✏️ Drawing & Erasing Engine
- **Pen & Highlighter Tools**: Dynamic freehand drawing with customizable stroke widths and vibrant color palettes.
- **Dual-Eraser System**:
  - **Stroke Eraser**: Instantly deletes whole lines or objects upon click/drag.
  - **Partial Eraser**: Rubs off specific segments of drawings using Fabric.js `EraserBrush`.

### 📝 Notes, Text & Frames
- **Sticky Notes**: Create colorful, resizable sticky notes with custom background colors (`#fef08a`, `#bbf7d0`, `#bae6fd`, `#fecdd3`, `#e9d5ff`, `#1e293b`) and inline editing.
- **Keyboard Text Boxes**: Full text editing with customizable typography (Inter, Roboto, Georgia, JetBrains Mono), text alignment, bold, and italic styles.
- **Whiteboard Frames**: Enclose objects inside named framed regions for modular organization.

### 📐 Comprehensive Shape Library
- Quick-add geometric shapes: **Rectangle**, **Rounded Rectangle**, **Circle**, **Triangle**, **Star**, **Hexagon**, **Diamond**, **Heart**, **Speech Bubble**, **Straight Line**, **Single Arrow**, and **Double Arrow**.

### 🛠️ Inspector & Object Manipulations
- **Contextual Inspector Bar**: Adjust object colors, stroke widths, text properties, and layer hierarchy (bring forward / send backward).
- **Multi-Select & Grouping**: Select multiple items simultaneously to group (`Ctrl + G`), ungroup (`Ctrl + Shift + G`), duplicate, or delete.
- **Undo / Redo Engine**: Full state stack history for instant undo (`Ctrl + Z`) and redo (`Ctrl + Y`).

### 💾 Persistence & File Exports
- **SQLite Database Persistence**: Auto-saves boards to a local SQLite database (`canvas_app.db`).
- **Saved Boards Drawer**: Easily manage, rename, create, or delete saved boards.
- **Export & Import**: Export canvas state as high-resolution **PNG** images or portable **JSON** files, and import existing JSON canvas backups.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), SQLite3, Pydantic
- **Frontend**: Vanilla JavaScript (ES6+), [Fabric.js 5.3.1](http://fabricjs.com/), [Tailwind CSS](https://tailwindcss.com/), [FontAwesome 6](https://fontawesome.com/)

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.8+** installed on your system.

### Installation

1. **Clone or navigate to the repository**:
   ```bash
   cd canvas
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

Launch the server with the single-click starter script:
```bash
python run.py
```
This command starts the **FastAPI** server at `http://127.0.0.1:8000` and automatically opens the app in your default web browser.

Alternatively, you can run Uvicorn directly:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

---

## 📁 Project Structure

```
canvas/
├── main.py              # FastAPI Web Server & REST API endpoints
├── database.py          # SQLite database schema, connections & CRUD methods
├── run.py               # One-click server runner & browser launcher
├── requirements.txt     # Python package requirements
├── canvas_app.db        # SQLite database file (auto-created on launch)
├── README.md            # Comprehensive project documentation
└── static/              # Web application frontend assets
    ├── index.html       # Main application markup & head metadata
    ├── css/
    │   └── style.css    # Custom styling, animations & theme overrides
    └── js/
        └── app.js       # Complete Fabric.js interactive canvas controller logic
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `GET /` | `GET` | Serves the main `CanvasLite` web application interface. |
| `GET /api/boards` | `GET` | Fetches a list of all saved boards (metadata & timestamps). |
| `POST /api/boards` | `POST` | Creates a new board in the database. |
| `GET /api/boards/{id}` | `GET` | Retrieves complete JSON data for a specific board ID. |
| `PUT /api/boards/{id}` | `PUT` | Updates board name, canvas state data, or thumbnail preview. |
| `DELETE /api/boards/{id}` | `DELETE` | Deletes a board from the database. |
| `POST /api/boards/import` | `POST` | Uploads and imports a JSON board file into SQLite. |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `V` | Switch to **Select & Move** tool |
| `M` / `Shift + Drag` | Activate **Multi-Select Box** tool |
| `H` or Hold `Space` | Activate **Pan Canvas / Hand** tool |
| `P` | Switch to **Pen Draw** tool |
| `T` | Add a **Keyboard Text Box** |
| `N` | Add a **Sticky Note** |
| `B` | Draw a **Whiteboard Frame** |
| `Ctrl + Z` | **Undo** last action |
| `Ctrl + Y` | **Redo** last action |
| `Ctrl + G` | **Group** selected objects |
| `Ctrl + Shift + G` | **Ungroup** selected objects |
| `Delete` / `Backspace` | **Delete** selected object(s) |

---

## 📄 License

This project is open source and available under the [Apache 2.0](LICENSE).

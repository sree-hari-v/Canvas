/**
 * CanvasLite Application Logic - Enhanced
 * Dual Erasers (Stroke vs Partial), Keyboard Textbox, Multi-Canvas Tabs, Undo/Redo & SQLite Sync
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let currentBoardId = 'default-board';
  let currentBoardName = 'Untitled Whiteboard';
  let activeTool = 'select'; // 'select', 'multiselect', 'pan', 'board', 'sticky', 'text', 'pen', 'highlighter', 'eraser-stroke', 'eraser-partial'
  let eraserType = 'stroke'; // 'stroke' (whole line) vs 'partial' (rub off)
  let autoSaveTimer = null;
  let isSaving = false;
  let hasUnsavedChanges = false;

  // Open Canvas Tabs Array
  let openTabs = [{ id: 'default-board', name: 'Untitled Whiteboard' }];

  // Undo / Redo History Stacks
  const undoStack = [];
  const redoStack = [];
  let isUndoRedoAction = false;
  const maxStackSize = 40;

  // Pan State
  let isPanning = false;
  let lastPosX = 0;
  let lastPosY = 0;
  let isSpacePressed = false;

  // Initialize Fabric Canvas
  const canvasElement = document.getElementById('main-canvas');
  const container = document.getElementById('canvas-container');

  const canvas = new fabric.Canvas('main-canvas', {
    width: window.innerWidth,
    height: window.innerHeight,
    selection: true,
    preserveObjectStacking: true,
    backgroundColor: 'transparent'
  });

  // Fabric controls customization
  fabric.Object.prototype.transparentCorners = false;
  fabric.Object.prototype.cornerColor = '#6366f1';
  fabric.Object.prototype.cornerStrokeColor = '#ffffff';
  fabric.Object.prototype.borderColor = '#818cf8';
  fabric.Object.prototype.cornerSize = 10;
  fabric.Object.prototype.cornerStyle = 'circle';
  fabric.Object.prototype.padding = 6;

  // Resize Listener
  window.addEventListener('resize', () => {
    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
    canvas.requestRenderAll();
  });

  // ----------------------------------------------------
  // UNDO & REDO ENGINE
  // ----------------------------------------------------
  const undoBtn = document.getElementById('tool-undo');
  const redoBtn = document.getElementById('tool-redo');

  function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.disabled = (undoStack.length === 0);
    if (redoBtn) redoBtn.disabled = (redoStack.length === 0);
  }

  function saveCanvasState() {
    if (isUndoRedoAction) return;
    const stateStr = JSON.stringify(canvas.toJSON(['isStickyNote', 'noteColor', 'isWhiteboardFrame', 'name']));
    
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === stateStr) {
      return;
    }

    undoStack.push(stateStr);
    if (undoStack.length > maxStackSize) undoStack.shift();
    redoStack.length = 0;

    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    isUndoRedoAction = true;

    const currentState = JSON.stringify(canvas.toJSON(['isStickyNote', 'noteColor', 'isWhiteboardFrame', 'name']));
    redoStack.push(currentState);

    const previousState = undoStack.pop();
    canvas.loadFromJSON(JSON.parse(previousState), () => {
      canvas.requestRenderAll();
      isUndoRedoAction = false;
      updateUndoRedoButtons();
      triggerAutoSave();
    });
  }

  function redo() {
    if (redoStack.length === 0) return;
    isUndoRedoAction = true;

    const currentState = JSON.stringify(canvas.toJSON(['isStickyNote', 'noteColor', 'isWhiteboardFrame', 'name']));
    undoStack.push(currentState);

    const nextState = redoStack.pop();
    canvas.loadFromJSON(JSON.parse(nextState), () => {
      canvas.requestRenderAll();
      isUndoRedoAction = false;
      updateUndoRedoButtons();
      triggerAutoSave();
    });
  }

  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);

  // ----------------------------------------------------
  // MULTI-CANVAS TABS BAR MANAGEMENT
  // ----------------------------------------------------
  const tabsBar = document.getElementById('canvas-tabs-bar');

  function renderTabs() {
    if (!tabsBar) return;
    tabsBar.innerHTML = '';

    openTabs.forEach(tab => {
      const tabEl = document.createElement('div');
      const isActive = (tab.id === currentBoardId);
      tabEl.className = `canvas-tab ${isActive ? 'active' : ''}`;

      tabEl.innerHTML = `
        <i class="fa-solid fa-chalkboard text-indigo-400 text-xs"></i>
        <span class="truncate">${tab.name}</span>
        ${openTabs.length > 1 ? `<span class="canvas-tab-close" data-id="${tab.id}"><i class="fa-solid fa-xmark"></i></span>` : ''}
      `;

      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.canvas-tab-close')) return;
        if (tab.id !== currentBoardId) {
          switchTab(tab.id);
        }
      });

      tabsBar.appendChild(tabEl);
    });

    document.querySelectorAll('.canvas-tab-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idToClose = closeBtn.getAttribute('data-id');
        closeTab(idToClose);
      });
    });

    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'canvas-tab-add';
    addTabBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> New Tab';
    addTabBtn.addEventListener('click', () => {
      createNewBoard('Untitled Whiteboard');
    });

    tabsBar.appendChild(addTabBtn);
  }

  async function switchTab(targetBoardId) {
    await saveCurrentBoard();
    await loadBoardById(targetBoardId);
  }

  function closeTab(targetBoardId) {
    const idx = openTabs.findIndex(t => t.id === targetBoardId);
    if (idx !== -1) {
      openTabs.splice(idx, 1);
      if (currentBoardId === targetBoardId && openTabs.length > 0) {
        const nextId = openTabs[Math.max(0, idx - 1)].id;
        switchTab(nextId);
      } else {
        renderTabs();
      }
    }
  }

  // ----------------------------------------------------
  // LIGHT & DARK THEME SWITCHER
  // ----------------------------------------------------
  const themeToggleBtn = document.getElementById('btn-toggle-theme');
  const themeIcon = document.getElementById('theme-icon');

  function initTheme() {
    const savedTheme = localStorage.getItem('canvas_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
      themeIcon.className = 'fa-solid fa-moon text-sm';
    } else {
      document.body.classList.remove('theme-light');
      themeIcon.className = 'fa-solid fa-sun text-sm';
    }
    updateGridBackground();
  }

  themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('canvas_theme', isLight ? 'light' : 'dark');
    themeIcon.className = isLight ? 'fa-solid fa-moon text-sm' : 'fa-solid fa-sun text-sm';
    updateGridBackground();
  });

  initTheme();

  // ----------------------------------------------------
  // FULLSCREEN MODE TOGGLE
  // ----------------------------------------------------
  const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
  const fullscreenIcon = document.getElementById('fullscreen-icon');

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        fullscreenIcon.className = 'fa-solid fa-compress text-sm';
      }).catch(err => console.error(err));
    } else {
      document.exitFullscreen().then(() => {
        fullscreenIcon.className = 'fa-solid fa-expand text-sm';
      });
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fullscreenIcon.className = 'fa-solid fa-expand text-sm';
    } else {
      fullscreenIcon.className = 'fa-solid fa-compress text-sm';
    }
  });

  // ----------------------------------------------------
  // GRID BACKGROUND TRACKING
  // ----------------------------------------------------
  function updateGridBackground() {
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const size = 24 * zoom;
    const offsetX = vpt[4] % size;
    const offsetY = vpt[5] % size;

    container.style.backgroundSize = `${size}px ${size}px`;
    container.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }

  // ----------------------------------------------------
  // INFINITE CANVAS PAN & ZOOM MECHANICS
  // ----------------------------------------------------
  canvas.on('mouse:wheel', function(opt) {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 5) zoom = 5;
    if (zoom < 0.1) zoom = 0.1;

    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();

    updateZoomDisplay();
    updateGridBackground();
  });

  // Spacebar Key Listeners
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpacePressed && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      isSpacePressed = true;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      if (activeTool !== 'pan') {
        canvas.defaultCursor = 'default';
        canvas.setCursor('default');
      }
    }
  });

  // Mouse Drag Panning & Stroke Eraser Mouse Down Handler
  canvas.on('mouse:down', function(opt) {
    const evt = opt.e;

    if (activeTool === 'pan' || isSpacePressed || evt.button === 1) {
      isPanning = true;
      canvas.selection = false;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      canvas.defaultCursor = 'grabbing';
      canvas.setCursor('grabbing');
      return;
    }

    // Stroke Eraser (Whole Line / Object deletion)
    if (activeTool === 'eraser-stroke' && opt.target) {
      canvas.remove(opt.target);
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  });

  canvas.on('mouse:move', function(opt) {
    if (isPanning) {
      const evt = opt.e;
      const vpt = canvas.viewportTransform;
      vpt[4] += evt.clientX - lastPosX;
      vpt[5] += evt.clientY - lastPosY;
      canvas.requestRenderAll();
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      updateGridBackground();
    } else if (activeTool === 'eraser-stroke' && opt.e.buttons === 1 && opt.target) {
      // Delete whole object on drag over in Stroke Eraser mode
      canvas.remove(opt.target);
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  });

  canvas.on('mouse:up', function() {
    if (isPanning) {
      canvas.setViewportTransform(canvas.viewportTransform);
      isPanning = false;
      canvas.selection = (activeTool === 'select' || activeTool === 'multiselect');
      canvas.defaultCursor = (activeTool === 'pan' || isSpacePressed) ? 'grab' : 'default';
      canvas.setCursor(canvas.defaultCursor);
    }
  });

  function updateZoomDisplay() {
    const percentage = Math.round(canvas.getZoom() * 100);
    document.getElementById('zoom-percentage').innerText = `${percentage}%`;
  }

  // ----------------------------------------------------
  // TOOL SELECTION ENGINE & DUAL ERASER MODES
  // ----------------------------------------------------
  const toolButtons = {
    select: document.getElementById('tool-select'),
    multiselect: document.getElementById('tool-multiselect'),
    pan: document.getElementById('tool-pan'),
    board: document.getElementById('tool-whiteboard-frame'),
    sticky: document.getElementById('tool-sticky'),
    text: document.getElementById('tool-text'),
    pen: document.getElementById('tool-pen'),
    highlighter: document.getElementById('tool-highlighter')
  };

  const eraserDropdownBtn = document.getElementById('btn-eraser-dropdown');
  const eraserMenu = document.getElementById('eraser-menu');
  const eraserActiveIcon = document.getElementById('eraser-active-icon');

  eraserDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    eraserMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => eraserMenu.classList.add('hidden'));

  document.getElementById('eraser-stroke').addEventListener('click', () => {
    eraserType = 'stroke';
    eraserActiveIcon.className = 'fa-solid fa-vector-square text-rose-400';
    setTool('eraser-stroke');
  });

  document.getElementById('eraser-partial').addEventListener('click', () => {
    eraserType = 'partial';
    eraserActiveIcon.className = 'fa-solid fa-broom text-amber-400';
    setTool('eraser-partial');
  });

  function setTool(toolName) {
    activeTool = toolName;
    
    // Deactivate standard tool buttons
    Object.keys(toolButtons).forEach(key => {
      if (toolButtons[key]) toolButtons[key].classList.remove('active');
    });
    if (eraserDropdownBtn) eraserDropdownBtn.classList.remove('active');

    if (toolButtons[toolName]) {
      toolButtons[toolName].classList.add('active');
    } else if (toolName.startsWith('eraser')) {
      if (eraserDropdownBtn) eraserDropdownBtn.classList.add('active');
    }

    canvas.isDrawingMode = false;
    canvas.selection = (toolName === 'select' || toolName === 'multiselect');

    if (toolName === 'pan') {
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
    } else if (toolName === 'eraser-stroke') {
      canvas.defaultCursor = 'crosshair';
      canvas.setCursor('crosshair');
    } else if (toolName === 'eraser-partial') {
      canvas.isDrawingMode = true;
      if (fabric.EraserBrush) {
        canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
        canvas.freeDrawingBrush.width = parseInt(document.getElementById('input-stroke-width').value) || 20;
      } else {
        // Fallback erasing brush
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = document.body.classList.contains('theme-light') ? '#f1f5f9' : '#0b0f19';
        canvas.freeDrawingBrush.width = 24;
      }
    } else if (toolName === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#6366f1';
      canvas.freeDrawingBrush.width = parseInt(document.getElementById('input-stroke-width').value) || 4;
    } else if (toolName === 'highlighter') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = 'rgba(250, 204, 21, 0.4)';
      canvas.freeDrawingBrush.width = 24;
    } else {
      canvas.defaultCursor = 'default';
      canvas.setCursor('default');
    }
  }

  Object.keys(toolButtons).forEach(tool => {
    if (toolButtons[tool]) {
      toolButtons[tool].addEventListener('click', () => {
        if (tool === 'sticky') {
          addStickyNote();
          setTool('select');
        } else if (tool === 'board') {
          addWhiteboardFrame();
          setTool('select');
        } else if (tool === 'text') {
          addTextBlock();
          setTool('select');
        } else {
          setTool(tool);
        }
      });
    }
  });

  // Shapes Dropdown Menu
  const shapesMenuBtn = document.getElementById('btn-shapes-dropdown');
  const shapesMenu = document.getElementById('shapes-menu');

  shapesMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shapesMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => shapesMenu.classList.add('hidden'));

  const shapeMap = {
    'shape-rect': 'rect',
    'shape-rounded-rect': 'rounded-rect',
    'shape-circle': 'circle',
    'shape-triangle': 'triangle',
    'shape-star': 'star',
    'shape-hexagon': 'hexagon',
    'shape-diamond': 'diamond',
    'shape-heart': 'heart',
    'shape-callout': 'callout',
    'shape-line': 'line',
    'shape-arrow': 'arrow',
    'shape-double-arrow': 'double-arrow'
  };

  Object.keys(shapeMap).forEach(btnId => {
    const el = document.getElementById(btnId);
    if (el) {
      el.addEventListener('click', () => {
        addShape(shapeMap[btnId]);
        setTool('select');
      });
    }
  });

  // ----------------------------------------------------
  // OBJECT CREATION (WHITEBOARD FRAME, STICKY NOTES, KEYBOARD TEXTBOX)
  // ----------------------------------------------------
  function getCenterCoords() {
    const vpt = canvas.viewportTransform;
    return {
      x: (-vpt[4] + canvas.width / 2) / canvas.getZoom(),
      y: (-vpt[5] + canvas.height / 2) / canvas.getZoom()
    };
  }

  // Keyboard Textbox Tool
  function addTextBlock() {
    const center = getCenterCoords();
    const textbox = new fabric.Textbox('Type your text here...', {
      left: center.x - 120,
      top: center.y - 30,
      width: 240,
      fontSize: 22,
      fontFamily: 'Inter, sans-serif',
      fill: document.body.classList.contains('theme-light') ? '#0f172a' : '#f8fafc',
      splitByGrapheme: true,
      editable: true
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    textbox.enterEditing();
    textbox.hiddenTextarea.focus();
    canvas.requestRenderAll();
    triggerAutoSave();
  }

  function addWhiteboardFrame() {
    const center = getCenterCoords();
    
    const bgSurface = new fabric.Rect({
      width: 640, height: 420,
      fill: document.body.classList.contains('theme-light') ? '#ffffff' : '#1e293b',
      stroke: '#6366f1', strokeWidth: 2, rx: 16, ry: 16,
      originX: 'center', originY: 'center', name: 'bgSurface'
    });

    const headerPanel = new fabric.Rect({
      width: 640, height: 44,
      fill: '#4338ca', rx: 16, ry: 16,
      originX: 'center', originY: 'center', top: -188, name: 'headerPanel'
    });

    const headerText = new fabric.IText('Whiteboard Frame', {
      fontSize: 16, fontFamily: 'Inter, sans-serif', fontWeight: 'bold', fill: '#ffffff',
      originX: 'center', originY: 'center', top: -188, name: 'headerText'
    });

    const whiteboardGroup = new fabric.Group([bgSurface, headerPanel, headerText], {
      left: center.x - 320, top: center.y - 210,
      shadow: new fabric.Shadow({
        color: 'rgba(0, 0, 0, 0.3)', blur: 24, offsetX: 6, offsetY: 12
      }),
      isWhiteboardFrame: true
    });

    canvas.add(whiteboardGroup);
    canvas.sendToBack(whiteboardGroup);
    canvas.setActiveObject(whiteboardGroup);
    canvas.requestRenderAll();
    triggerAutoSave();
  }

  function addStickyNote(color = '#fef08a', text = 'New Note\nDouble click to edit') {
    const center = getCenterCoords();
    
    const bgRect = new fabric.Rect({
      width: 200, height: 200, fill: color, rx: 12, ry: 12,
      originX: 'center', originY: 'center', name: 'bgRect'
    });

    const textObj = new fabric.IText(text, {
      fontSize: 16, fontFamily: 'Inter, sans-serif',
      fill: color === '#1e293b' ? '#f8fafc' : '#1e293b',
      textAlign: 'center', originX: 'center', originY: 'center',
      width: 170, splitByGrapheme: true, name: 'textObj'
    });

    const stickyGroup = new fabric.Group([bgRect, textObj], {
      left: center.x - 100, top: center.y - 100,
      shadow: new fabric.Shadow({
        color: 'rgba(0, 0, 0, 0.25)', blur: 16, offsetX: 4, offsetY: 8
      }),
      isStickyNote: true, noteColor: color
    });

    canvas.add(stickyGroup);
    canvas.setActiveObject(stickyGroup);
    canvas.requestRenderAll();
    triggerAutoSave();
  }

  function addShape(type) {
    const center = getCenterCoords();
    let shape;

    const defaultFill = '#334155';
    const defaultStroke = '#6366f1';

    if (type === 'rect') {
      shape = new fabric.Rect({
        left: center.x - 75, top: center.y - 50,
        width: 150, height: 100, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2, rx: 4, ry: 4
      });
    } else if (type === 'rounded-rect') {
      shape = new fabric.Rect({
        left: center.x - 75, top: center.y - 50,
        width: 150, height: 100, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2, rx: 20, ry: 20
      });
    } else if (type === 'circle') {
      shape = new fabric.Circle({
        left: center.x - 60, top: center.y - 60,
        radius: 60, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2
      });
    } else if (type === 'triangle') {
      shape = new fabric.Triangle({
        left: center.x - 60, top: center.y - 60,
        width: 120, height: 110, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2
      });
    } else if (type === 'star') {
      const points = [
        {x: 0, y: -50}, {x: 14, y: -20}, {x: 47, y: -15}, {x: 23, y: 9},
        {x: 29, y: 40}, {x: 0, y: 25}, {x: -29, y: 40}, {x: -23, y: 9},
        {x: -47, y: -15}, {x: -14, y: -20}
      ];
      shape = new fabric.Polygon(points, {
        left: center.x - 47, top: center.y - 50,
        fill: '#f59e0b', stroke: '#d97706', strokeWidth: 2
      });
    } else if (type === 'hexagon') {
      const points = [
        {x: 30, y: 0}, {x: 80, y: 0}, {x: 105, y: 43},
        {x: 80, y: 86}, {x: 30, y: 86}, {x: 5, y: 43}
      ];
      shape = new fabric.Polygon(points, {
        left: center.x - 55, top: center.y - 43,
        fill: defaultFill, stroke: defaultStroke, strokeWidth: 2
      });
    } else if (type === 'diamond') {
      const points = [{x: 50, y: 0}, {x: 100, y: 60}, {x: 50, y: 120}, {x: 0, y: 60}];
      shape = new fabric.Polygon(points, {
        left: center.x - 50, top: center.y - 60,
        fill: defaultFill, stroke: defaultStroke, strokeWidth: 2
      });
    } else if (type === 'heart') {
      const pathStr = 'M 272.7014 238.7173 C 206.4614 121.2973 93.5614 194.6173 143.0814 304.5773 C 192.6014 414.5373 272.7014 461.6173 272.7014 461.6173 C 272.7014 461.6173 352.8014 414.5373 402.3214 304.5773 C 451.8414 194.6173 338.9414 121.2973 272.7014 238.7173 Z';
      shape = new fabric.Path(pathStr, {
        left: center.x - 60, top: center.y - 60,
        scaleX: 0.35, scaleY: 0.35,
        fill: '#f43f5e', stroke: '#e11d48', strokeWidth: 2
      });
    } else if (type === 'callout') {
      const rect = new fabric.Rect({ width: 140, height: 80, rx: 12, ry: 12, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2 });
      const tail = new fabric.Triangle({ width: 20, height: 20, fill: defaultFill, stroke: defaultStroke, strokeWidth: 2, left: 30, top: 76, angle: 180 });
      shape = new fabric.Group([rect, tail], { left: center.x - 70, top: center.y - 40 });
    } else if (type === 'line') {
      shape = new fabric.Line([center.x - 100, center.y, center.x + 100, center.y], {
        stroke: defaultStroke, strokeWidth: 4
      });
    } else if (type === 'arrow') {
      const line = new fabric.Line([0, 0, 160, 0], { stroke: defaultStroke, strokeWidth: 4 });
      const triangle = new fabric.Triangle({
        width: 16, height: 16, fill: defaultStroke, left: 160, top: 0, angle: 90, originX: 'center', originY: 'center'
      });
      shape = new fabric.Group([line, triangle], { left: center.x - 80, top: center.y });
    } else if (type === 'double-arrow') {
      const line = new fabric.Line([0, 0, 160, 0], { stroke: defaultStroke, strokeWidth: 4 });
      const head1 = new fabric.Triangle({ width: 16, height: 16, fill: defaultStroke, left: 0, top: 0, angle: -90, originX: 'center', originY: 'center' });
      const head2 = new fabric.Triangle({ width: 16, height: 16, fill: defaultStroke, left: 160, top: 0, angle: 90, originX: 'center', originY: 'center' });
      shape = new fabric.Group([line, head1, head2], { left: center.x - 80, top: center.y });
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  }

  // ----------------------------------------------------
  // DOUBLE CLICK EDITING FOR STICKY NOTE GROUPS
  // ----------------------------------------------------
  canvas.on('mouse:dblclick', function(opt) {
    const target = opt.target;
    if (target && target.type === 'group' && target.isStickyNote) {
      const textObj = target.getObjects().find(o => o.name === 'textObj');
      if (textObj) {
        const items = target._restoreObjectsState().getObjects();
        canvas.remove(target);

        const groupLeft = target.left;
        const groupTop = target.top;

        items.forEach(item => canvas.add(item));

        textObj.enterEditing();
        textObj.hiddenTextarea.focus();
        canvas.setActiveObject(textObj);

        textObj.on('editing:exited', function() {
          const bgRect = items.find(o => o.name === 'bgRect');
          canvas.remove(bgRect);
          canvas.remove(textObj);

          const newGroup = new fabric.Group([bgRect, textObj], {
            left: groupLeft, top: groupTop,
            shadow: new fabric.Shadow({
              color: 'rgba(0, 0, 0, 0.25)', blur: 16, offsetX: 4, offsetY: 8
            }),
            isStickyNote: true, noteColor: bgRect.fill
          });

          canvas.add(newGroup);
          canvas.setActiveObject(newGroup);
          canvas.requestRenderAll();
          triggerAutoSave();
        });
      }
    }
  });

  // ----------------------------------------------------
  // INSPECTOR BAR & TEXT FORMATTING CONTROLS
  // ----------------------------------------------------
  const inspectorBar = document.getElementById('inspector-bar');
  const multiSelectIndicator = document.getElementById('multi-select-indicator');
  const multiSelectCount = document.getElementById('multi-select-count');
  const multiSelectActions = document.getElementById('multi-select-actions');
  const textFormattingControls = document.getElementById('text-formatting-controls');
  const strokeWidthInput = document.getElementById('input-stroke-width');
  const strokeWidthVal = document.getElementById('stroke-width-val');

  canvas.on('selection:created', updateInspector);
  canvas.on('selection:updated', updateInspector);
  canvas.on('selection:cleared', () => inspectorBar.classList.add('hidden'));

  function updateInspector() {
    const activeObjects = canvas.getActiveObjects();
    if (!activeObjects || activeObjects.length === 0) {
      inspectorBar.classList.add('hidden');
      return;
    }

    inspectorBar.classList.remove('hidden');

    const firstObj = activeObjects[0];
    if (firstObj && (firstObj.type === 'textbox' || firstObj.type === 'i-text')) {
      textFormattingControls.classList.remove('hidden');
      document.getElementById('select-font-family').value = firstObj.fontFamily || 'Inter, sans-serif';
    } else {
      textFormattingControls.classList.add('hidden');
    }

    if (activeObjects.length > 1) {
      multiSelectIndicator.classList.remove('hidden');
      multiSelectActions.classList.remove('hidden');
      multiSelectCount.innerText = `${activeObjects.length} items selected`;
    } else {
      multiSelectIndicator.classList.add('hidden');
      multiSelectActions.classList.add('hidden');
    }
  }

  // Text Formatting Handlers
  document.getElementById('select-font-family').addEventListener('change', (e) => {
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'i-text')) {
      activeObj.set('fontFamily', e.target.value);
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  });

  document.getElementById('btn-text-bold').addEventListener('click', () => {
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'i-text')) {
      const isBold = activeObj.fontWeight === 'bold';
      activeObj.set('fontWeight', isBold ? 'normal' : 'bold');
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  });

  document.getElementById('btn-text-italic').addEventListener('click', () => {
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'i-text')) {
      const isItalic = activeObj.fontStyle === 'italic';
      activeObj.set('fontStyle', isItalic ? 'normal' : 'italic');
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  });

  // Multi-select Group & Ungroup Handlers
  document.getElementById('btn-group').addEventListener('click', groupSelectedObjects);
  document.getElementById('btn-ungroup').addEventListener('click', ungroupSelectedObjects);

  function groupSelectedObjects() {
    if (!canvas.getActiveObject()) return;
    if (canvas.getActiveObject().type !== 'activeSelection') return;
    canvas.getActiveObject().toGroup();
    canvas.requestRenderAll();
    triggerAutoSave();
  }

  function ungroupSelectedObjects() {
    if (!canvas.getActiveObject()) return;
    if (canvas.getActiveObject().type !== 'group') return;
    canvas.getActiveObject().toActiveSelection();
    canvas.requestRenderAll();
    triggerAutoSave();
  }

  // Color Swatch Handler
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');

      const color = swatch.getAttribute('data-color');
      applyColorToSelected(color);
    });
  });

  document.getElementById('custom-color-picker').addEventListener('input', (e) => {
    applyColorToSelected(e.target.value);
  });

  function applyColorToSelected(color) {
    const activeObjects = canvas.getActiveObjects();
    if (!activeObjects || activeObjects.length === 0) return;

    activeObjects.forEach(obj => {
      if (obj.isStickyNote) {
        obj.noteColor = color;
        const bgRect = obj.getObjects().find(o => o.name === 'bgRect');
        const textObj = obj.getObjects().find(o => o.name === 'textObj');
        if (bgRect) bgRect.set('fill', color);
        if (textObj) textObj.set('fill', color === '#1e293b' ? '#f8fafc' : '#1e293b');
      } else if (obj.isWhiteboardFrame) {
        const bgSurface = obj.getObjects().find(o => o.name === 'bgSurface');
        if (bgSurface) bgSurface.set('fill', color);
      } else if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
        obj.set('fill', color);
      } else if (obj.type === 'path' || obj.type === 'line') {
        obj.set('stroke', color);
      } else {
        obj.set('fill', color);
      }
    });

    canvas.requestRenderAll();
    triggerAutoSave();
  }

  strokeWidthInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    strokeWidthVal.innerText = val;

    if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = val;
    }

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => {
      if (obj.type === 'path' || obj.type === 'line') {
        obj.set('strokeWidth', val);
      }
    });

    canvas.requestRenderAll();
    triggerAutoSave();
  });

  // Layering & Actions
  document.getElementById('btn-bring-forward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringForward(obj); triggerAutoSave(); }
  });

  document.getElementById('btn-send-backward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendBackwards(obj); triggerAutoSave(); }
  });

  document.getElementById('btn-duplicate').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.clone((cloned) => {
        canvas.discardActiveObject();
        cloned.set({
          left: cloned.left + 25,
          top: cloned.top + 25,
          evented: true
        });
        if (cloned.type === 'activeSelection') {
          cloned.canvas = canvas;
          cloned.forEachObject((o) => canvas.add(o));
          cloned.setCoordinates();
        } else {
          canvas.add(cloned);
        }
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        triggerAutoSave();
      });
    }
  });

  function deleteSelectedElements() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      triggerAutoSave();
    }
  }

  document.getElementById('btn-delete-selected').addEventListener('click', deleteSelectedElements);

  // Global Keyboard Shortcuts (Undo, Redo, Delete/Backspace, Select All & Grouping)
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const activeObj = canvas.getActiveObject();
    const isTyping = (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeObj && activeObj.isEditing));
    
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedElements();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      canvas.setActiveObject(new fabric.ActiveSelection(canvas.getObjects(), { canvas: canvas }));
      canvas.requestRenderAll();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      if (e.shiftKey) {
        ungroupSelectedObjects();
      } else {
        groupSelectedObjects();
      }
    }
  });

  // Zoom Controls
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, canvas.getZoom() * 1.2);
    updateZoomDisplay();
    updateGridBackground();
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, canvas.getZoom() / 1.2);
    updateZoomDisplay();
    updateGridBackground();
  });

  document.getElementById('btn-zoom-reset').addEventListener('click', () => {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    updateZoomDisplay();
    updateGridBackground();
  });

  document.getElementById('btn-fit-content').addEventListener('click', () => {
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      const bound = obj.getBoundingRect();
      if (bound.left < minX) minX = bound.left;
      if (bound.top < minY) minY = bound.top;
      if (bound.left + bound.width > maxX) maxX = bound.left + bound.width;
      if (bound.top + bound.height > maxY) maxY = bound.top + bound.height;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const scale = Math.min(canvas.width / (contentWidth + 100), canvas.height / (contentHeight + 100));

    const vpt = canvas.viewportTransform;
    vpt[0] = scale; vpt[3] = scale;
    vpt[4] = (canvas.width - contentWidth * scale) / 2 - minX * scale;
    vpt[5] = (canvas.height - contentHeight * scale) / 2 - minY * scale;

    canvas.requestRenderAll();
    updateZoomDisplay();
    updateGridBackground();
  });

  document.getElementById('btn-clear-canvas').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all elements from this canvas?')) {
      canvas.clear();
      triggerAutoSave();
    }
  });

  // ----------------------------------------------------
  // AUTO-SAVE & BACKEND PERSISTENCE (FastAPI + SQLite)
  // ----------------------------------------------------
  canvas.on('object:added', () => { saveCanvasState(); triggerAutoSave(); });
  canvas.on('object:modified', () => { saveCanvasState(); triggerAutoSave(); });
  canvas.on('object:removed', () => { saveCanvasState(); triggerAutoSave(); });
  canvas.on('path:created', () => { saveCanvasState(); triggerAutoSave(); });

  function setSaveStatus(status) {
    const badge = document.getElementById('save-status-badge');
    if (status === 'saved') {
      badge.className = 'save-badge saved';
      badge.innerHTML = '<i class="fa-solid fa-circle-check text-[10px]"></i><span>Saved</span>';
    } else if (status === 'saving') {
      badge.className = 'save-badge saving';
      badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i><span>Saving...</span>';
    } else if (status === 'unsaved') {
      badge.className = 'save-badge unsaved';
      badge.innerHTML = '<i class="fa-solid fa-circle-exclamation text-[10px]"></i><span>Unsaved</span>';
    }
  }

  function triggerAutoSave() {
    setSaveStatus('unsaved');
    hasUnsavedChanges = true;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveCurrentBoard();
    }, 1500);
  }

  async function saveCurrentBoard() {
    if (isSaving) return;
    isSaving = true;
    setSaveStatus('saving');

    try {
      const jsonCanvas = canvas.toJSON(['isStickyNote', 'noteColor', 'isWhiteboardFrame', 'name']);
      const dataStr = JSON.stringify(jsonCanvas);

      const response = await fetch(`/api/boards/${currentBoardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentBoardName,
          data: dataStr
        })
      });

      if (response.ok) {
        setSaveStatus('saved');
        hasUnsavedChanges = false;
        loadBoardsList();
      } else {
        setSaveStatus('unsaved');
      }
    } catch (err) {
      console.error('Error saving board:', err);
      setSaveStatus('unsaved');
    } finally {
      isSaving = false;
    }
  }

  document.getElementById('btn-manual-save').addEventListener('click', () => {
    saveCurrentBoard();
  });

  const boardTitleInput = document.getElementById('board-title-input');
  boardTitleInput.addEventListener('change', () => {
    currentBoardName = boardTitleInput.value.trim() || 'Untitled Whiteboard';
    
    const activeTabObj = openTabs.find(t => t.id === currentBoardId);
    if (activeTabObj) activeTabObj.name = currentBoardName;
    renderTabs();
    
    triggerAutoSave();
  });

  // ----------------------------------------------------
  // BOARD FILE MANAGER & DRAWER LOGIC
  // ----------------------------------------------------
  const drawer = document.getElementById('board-drawer');
  const toggleDrawerBtn = document.getElementById('btn-toggle-drawer');
  const closeDrawerBtn = document.getElementById('btn-close-drawer');

  toggleDrawerBtn.addEventListener('click', () => {
    drawer.classList.toggle('drawer-open');
    if (drawer.classList.contains('drawer-open')) {
      loadBoardsList();
    }
  });

  closeDrawerBtn.addEventListener('click', () => {
    drawer.classList.remove('drawer-open');
  });

  async function loadBoardsList() {
    try {
      const res = await fetch('/api/boards');
      const boards = await res.json();
      const container = document.getElementById('boards-list-container');
      container.innerHTML = '';

      boards.forEach(b => {
        const item = document.createElement('div');
        const isActive = (b.id === currentBoardId);
        item.className = `p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
          isActive 
            ? 'bg-indigo-900/40 border-indigo-500/60 text-white shadow-md' 
            : 'bg-slate-800/40 hover:bg-slate-700/50 border-slate-700/50 text-slate-300'
        }`;

        item.innerHTML = `
          <div class="flex items-center gap-3 overflow-hidden">
            <i class="fa-solid fa-chalkboard text-indigo-400 text-sm"></i>
            <div class="truncate">
              <div class="font-medium text-xs truncate">${b.name}</div>
              <div class="text-[10px] text-slate-400">${new Date(b.updated_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            ${!isActive ? `<button class="btn-delete-board p-1 text-slate-400 hover:text-red-400 rounded" data-id="${b.id}"><i class="fa-solid fa-trash-can text-xs"></i></button>` : ''}
          </div>
        `;

        item.addEventListener('click', (e) => {
          if (e.target.closest('.btn-delete-board')) return;
          if (b.id !== currentBoardId) {
            loadBoardById(b.id);
            drawer.classList.remove('drawer-open');
          }
        });

        container.appendChild(item);
      });

      document.querySelectorAll('.btn-delete-board').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this saved canvas board?')) {
            await fetch(`/api/boards/${id}`, { method: 'DELETE' });
            loadBoardsList();
          }
        });
      });

    } catch (err) {
      console.error('Error loading boards list:', err);
    }
  }

  async function loadBoardById(boardId) {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) return;

      const board = await res.json();
      currentBoardId = board.id;
      currentBoardName = board.name;
      boardTitleInput.value = board.name;

      if (!openTabs.some(t => t.id === board.id)) {
        openTabs.push({ id: board.id, name: board.name });
      }
      renderTabs();

      undoStack.length = 0;
      redoStack.length = 0;
      updateUndoRedoButtons();

      if (board.data) {
        const parsed = JSON.parse(board.data);
        canvas.loadFromJSON(parsed, () => {
          canvas.requestRenderAll();
          saveCanvasState();
          setSaveStatus('saved');
          updateGridBackground();
        });
      } else {
        canvas.clear();
        saveCanvasState();
      }
    } catch (err) {
      console.error('Error loading board:', err);
    }
  }

  async function createNewBoard(name = 'Untitled Whiteboard', initialData = null) {
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          data: initialData
        })
      });
      const newBoard = await res.json();
      await loadBoardById(newBoard.id);
      drawer.classList.remove('drawer-open');
    } catch (err) {
      console.error('Error creating new board:', err);
    }
  }

  document.getElementById('btn-header-add-board').addEventListener('click', () => createNewBoard());
  document.getElementById('btn-drawer-new').addEventListener('click', () => createNewBoard());
  document.getElementById('btn-menu-new').addEventListener('click', () => createNewBoard());

  // ----------------------------------------------------
  // OPEN EXISTING LOCAL FILE & IMPORT / EXPORT
  // ----------------------------------------------------
  const localFileInput = document.getElementById('local-file-input');

  function triggerOpenLocalFile() {
    localFileInput.click();
  }

  document.getElementById('btn-menu-open-file').addEventListener('click', triggerOpenLocalFile);
  document.getElementById('btn-drawer-import').addEventListener('click', triggerOpenLocalFile);

  localFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonContent = event.target.result;
        const fileName = file.name.replace(/\.json$/i, '');
        await createNewBoard(fileName, jsonContent);
        localFileInput.value = '';
      };
      reader.readAsText(file);
    } catch (err) {
      alert('Failed to read canvas file. Please ensure it is a valid JSON export.');
      console.error('File import error:', err);
    }
  });

  // Export as JSON File
  document.getElementById('btn-menu-export-json').addEventListener('click', () => {
    const jsonCanvas = canvas.toJSON(['isStickyNote', 'noteColor', 'isWhiteboardFrame', 'name']);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonCanvas, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentBoardName.toLowerCase().replace(/\s+/g, '_')}_canvas.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Export as PNG Image
  document.getElementById('btn-menu-export-png').addEventListener('click', () => {
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
      quality: 1
    });
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataURL);
    downloadAnchor.setAttribute("download", `${currentBoardName.toLowerCase().replace(/\s+/g, '_')}.png`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // File Menu Dropdown Toggle
  const fileMenuBtn = document.getElementById('btn-file-menu');
  const fileMenuDropdown = document.getElementById('file-menu-dropdown');

  fileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileMenuDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    fileMenuDropdown.classList.add('hidden');
  });

  // Initial Load of default board from SQLite
  loadBoardById('default-board');
});

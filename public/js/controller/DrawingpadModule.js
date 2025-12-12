// webtouch-sdk/public-js/controller/DrawingPadModule.js

const TOOLS_SLICE = 'drawingpad.state';

export class DrawingpadModule {
  constructor({ controllerClient, parent, store }) {
    if (!controllerClient) throw new Error('DrawingPadModule: client required');
    if (!parent) throw new Error('DrawingPadModule: parent required');
    
    this.client = controllerClient;
    this.parent = parent;
    this.store = store || null; 
    this.unsubscribeStore = null;

    // Internal State
    this.state = {
      mode: 'draw',       // 'draw' | 'type' | 'erase' | 'pan'
      color: '#000000',
      lineWidth: 4,
      isPenToggled: false 
    };

    // Tracking State
    this.activePointers = new Map();
    this.activeStrokeIds = new Map();
    this.isLocked = false;         
    this.isMomentaryDraw = false;  
    
    // Gesture State
    this.touchStartCount = 0;
    this.touchStartTime = 0;
    this.twoFingerTapDetected = false;

    // Mobile Touch Tracking
    this.prevTouchX = null;
    this.prevTouchY = null;

    // Bind methods for document listeners so they can be removed
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onDocMouseDown = this._onDocMouseDown.bind(this);
    this._onDocMouseUp = this._onDocMouseUp.bind(this);
    this._onDocMouseMove = this._onDocMouseMove.bind(this);

    this.rootElement = this._render();
    this.parent.appendChild(this.rootElement);

    this._cacheDom();
    this._attachToolbarListeners();
    this._attachPadListeners();
    
    this._syncUi();
    this._broadcastAll();

    if (this.store) this._initStore();
  }

  /**
   * Cleanup method to remove global listeners and DOM elements.
   * Essential for SPA routing.
   */
  destroy() {
    // 1. Unsubscribe from state
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }

    // 2. Remove Global Listeners
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousedown', this._onDocMouseDown);
    document.removeEventListener('mouseup', this._onDocMouseUp);
    document.removeEventListener('mousemove', this._onDocMouseMove);

    // 3. Remove DOM
    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Rendering
  // ---------------------------------------------------------------------------

  _render() {
    const container = document.createElement('div');
    container.className = 'webtouch-drawing-pad';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.flexGrow = '1'; 
    container.style.height = '100%'; 

    container.innerHTML = `
      <!-- Toolbar -->
      <div class="dp-tools-panel" style="padding: 10px; background: #f0f0f0; border-bottom: 1px solid #ccc;">
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:5px; justify-content:center;">
          <button type="button" data-mode="draw" class="dp-btn dp-btn-mode">✏️ Draw</button>
          <button type="button" data-mode="type" class="dp-btn dp-btn-mode">⌨️ Type</button>
          <button type="button" data-mode="erase" class="dp-btn dp-btn-mode">🧽 Erase</button>
          <button type="button" data-mode="pan" class="dp-btn dp-btn-mode">🖐 Pan</button>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:center;">
          <label style="font-size:0.85rem;">
            Color <input type="color" data-role="color-input" value="#000000">
          </label>
          <label style="font-size:0.85rem;">
            Size <input type="range" data-role="size-input" min="1" max="25" value="4">
          </label>
        </div>

        <div style="display:flex; gap:5px; justify-content:center; margin-top:5px;">
          <button type="button" data-role="undo-btn" class="dp-btn">↩ Undo</button>
          <button type="button" data-role="clear-btn" class="dp-btn" style="color:red;">🧹 Clear</button>
        </div>
      </div>

      <!-- Pad Surface -->
      <div class="dp-pad-wrapper" style="flex-grow:1; display:flex; flex-direction:column; padding:10px; position:relative;">
        <div id="dpTrackpad" style="
           position: relative;
           flex-grow: 1;
           cursor: default; 
           touch-action: none;
           background: #f9fafb;
           border: 2px dashed #ccc;
           border-radius: 12px;
           display: flex;
           align-items: center;
           justify-content: center;
           text-align: center;
           transition: background 0.3s, border-color 0.3s;
           user-select: none;
           -webkit-user-select: none;
        ">
          <div id="dpPadHint" style="pointer-events: none; color: #6b7280;">
            <span style="font-size: 24px;">🖱️</span><br>
            <b>Laptop:</b> Double-Click to Control TV<br>
            <span style="font-size: 0.8em">(ESC to exit)</span>
            <br><br>
            <b>Phone:</b> Drag to move
          </div>
        </div>
        
        <!-- Toggle Button -->
        <button id="dpToggleBtn" style="
          height: 60px; margin-top: 10px; border-radius: 12px;
          background: #e5e7eb; color: #374151; font-weight: bold; font-size: 1rem;
          border: 2px solid #d1d5db; cursor: pointer; transition: all 0.2s ease;
        ">PEN IS UP (HOVERING)</button>
      </div>
    `;
    return container;
  }

  _cacheDom() {
    const root = this.rootElement;
    this.modeButtons = Array.from(root.querySelectorAll('.dp-btn-mode'));
    this.colorInput = root.querySelector('[data-role="color-input"]');
    this.sizeInput = root.querySelector('[data-role="size-input"]');
    this.undoBtn = root.querySelector('[data-role="undo-btn"]');
    this.clearBtn = root.querySelector('[data-role="clear-btn"]');
    
    this.padSurface = root.querySelector('#dpTrackpad');
    this.padHint = root.querySelector('#dpPadHint');
    this.toggleBtn = root.querySelector('#dpToggleBtn');
  }

  // ---------------------------------------------------------------------------
  // 2. Logic: Toolbar & Toggle
  // ---------------------------------------------------------------------------

  _attachToolbarListeners() {
    this.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.mode = btn.dataset.mode;
        this._syncUi();
        this._broadcastMode();
        this._updateStore();
      });
    });

    this.colorInput.addEventListener('input', () => {
      this.state.color = this.colorInput.value;
      this._broadcastColor();
      this._updateStore();
    });

    this.sizeInput.addEventListener('input', () => {
      this.state.lineWidth = Number(this.sizeInput.value);
      this._broadcastSize();
      this._updateStore();
    });

    this.undoBtn.addEventListener('click', () => this._broadcastUndo());
    this.clearBtn.addEventListener('click', () => this._broadcastClear());

    this.toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Type Mode: Momentary click action
      if (this.state.mode === 'type') {
         if (navigator.vibrate) navigator.vibrate(50);
         const id = `type-${Date.now()}`;
         this.client.sendCustomEvent({ eventName: 'draw:strokeStart', payload: { id, tool: 'type' } });
         setTimeout(() => this.client.sendCustomEvent({ eventName: 'draw:strokeEnd', payload: { id } }), 50);
         return;
      }

      this.state.isPenToggled = !this.state.isPenToggled;
      this._syncUi();
      this._updateStore();
      
      if (this.state.isPenToggled) {
        if (navigator.vibrate) navigator.vibrate(50);
        this._broadcastStrokeStart('main-toggle');
      } else {
        if (navigator.vibrate) navigator.vibrate(20);
        this._broadcastStrokeEnd('main-toggle');
      }
    });
  }

  _syncUi() {
    this.modeButtons.forEach(btn => {
      btn.style.backgroundColor = (btn.dataset.mode === this.state.mode) ? '#d1fae5' : '#eeeeee';
      btn.style.borderColor = (btn.dataset.mode === this.state.mode) ? '#10b981' : '#cccccc';
    });
    
    this.colorInput.value = this.state.color;
    this.sizeInput.value = this.state.lineWidth;

    const btn = this.toggleBtn;
    if (this.state.mode === 'pan') {
      btn.textContent = "HOLD / TOGGLE TO DRAG VIEW";
      btn.style.background = "#f59e0b";
      btn.style.color = "white";
      btn.style.border = "2px solid #d97706";
    } else if (this.state.mode === 'type') {
      btn.textContent = "CLICK TO EDIT TEXT"; 
      btn.style.background = "#8b5cf6"; 
      btn.style.color = "white"; 
      btn.style.border = "2px solid #7c3aed";
    } else {
      const active = this.state.isPenToggled || this.isMomentaryDraw;
      if (active) {
        btn.textContent = this.state.mode === 'erase' ? "ERASER DOWN" : "PEN IS DOWN (DRAWING)";
        btn.style.background = this.state.mode === 'erase' ? "#ef4444" : "#10b981";
        btn.style.color = "white";
        btn.style.border = "2px solid " + (this.state.mode === 'erase' ? "#b91c1c" : "#059669");
      } else {
        btn.textContent = "PEN IS UP (HOVERING)";
        btn.style.background = "#e5e7eb";
        btn.style.color = "#374151";
        btn.style.border = "2px solid #d1d5db";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Logic: Pad Input
  // ---------------------------------------------------------------------------

  _attachPadListeners() {
    const pad = this.padSurface;

    // Pointer Lock (Requires global listeners)
    pad.addEventListener('dblclick', async () => {
      if (!this.isLocked) {
        try { await pad.requestPointerLock(); } catch(e){}
      } else document.exitPointerLock();
    });

    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousedown', this._onDocMouseDown);
    document.addEventListener('mouseup', this._onDocMouseUp);
    document.addEventListener('mousemove', this._onDocMouseMove);

    // Touch/Pointer (Local listeners, cleaned up by removing root)
    pad.addEventListener('contextmenu', e => e.preventDefault());
    pad.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') this._handleDown(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') this._handleMove(e); });
    pad.addEventListener('pointerup', e => this._handleUp(e));
    pad.addEventListener('pointercancel', e => this._handleUp(e));
  }

  // --- Global Document Handlers (extracted for cleanup) ---

  _onPointerLockChange() {
    this.isLocked = (document.pointerLockElement === this.padSurface);
    this._updatePadVisuals();
  }

  _onDocMouseDown(e) {
    if (this.isLocked && e.button === 0) {
      this.isMomentaryDraw = true;
      this._syncUi();
      this._broadcastStrokeStart('mouse-lock');
    }
  }

  _onDocMouseUp(e) {
    if (this.isLocked && e.button === 0) {
      this.isMomentaryDraw = false;
      this._syncUi();
      this._broadcastStrokeEnd('mouse-lock');
    }
  }

  _onDocMouseMove(e) {
    if (this.isLocked && (e.movementX || e.movementY)) {
      this.client.sendCursorMove({ deltaX: e.movementX, deltaY: e.movementY });
    }
  }

  _updatePadVisuals() {
    if (this.isLocked) {
      this.padSurface.style.borderColor = "#3b82f6";
      this.padSurface.style.background = "#eff6ff";
      this.padHint.innerHTML = `<span style="font-size:30px; color:#3b82f6;">🔒</span><br><b>TV CONTROL ACTIVE</b><br>Press ESC to Release Mouse`;
    } else {
      this.padSurface.style.borderColor = "#ccc";
      this.padSurface.style.background = "#f9fafb";
      this.padHint.innerHTML = `<span style="font-size: 24px;">🖱️</span><br><b>Laptop:</b> Double-Click to Control TV<br><span style="font-size: 0.8em">(ESC to exit)</span><br><br><b>Phone:</b> Drag to move`;
    }
  }

  _handleDown(e) {
    e.preventDefault();
    try { this.padSurface.setPointerCapture(e.pointerId); } catch(err){}
    
    this.activePointers.set(e.pointerId, {
      prevX: e.clientX, prevY: e.clientY,
      startX: e.clientX, startY: e.clientY,
      startTime: Date.now(),
      moved: false
    });

    if (this.activePointers.size === 2) {
      this.isMomentaryDraw = true;
      this.touchStartCount = 2;
      this.touchStartTime = Date.now();
      this.twoFingerTapDetected = false;
      this._syncUi();
    }

    if (this.state.isPenToggled || this.isMomentaryDraw) {
      this._broadcastStrokeStart(e.pointerId);
    }
  }

  _handleMove(e) {
    e.preventDefault();
    const p = this.activePointers.get(e.pointerId);
    if (!p) return;

    const dx = e.clientX - p.prevX;
    const dy = e.clientY - p.prevY;
    p.prevX = e.clientX;
    p.prevY = e.clientY;

    if (dx !== 0 || dy !== 0) {
      p.moved = true;
      this.client.sendCursorMove({ deltaX: dx, deltaY: dy });
    }

    if (this.activePointers.size >= 2 && !this.isMomentaryDraw) {
      this.isMomentaryDraw = true;
      this._syncUi();
    }
    
    if ((this.state.isPenToggled || this.isMomentaryDraw) && !this.activeStrokeIds.has(e.pointerId)) {
      this._broadcastStrokeStart(e.pointerId);
    }
  }

  _handleUp(e) {
    e.preventDefault();
    const p = this.activePointers.get(e.pointerId);
    this._broadcastStrokeEnd(e.pointerId);
    this.activePointers.delete(e.pointerId);

    if (p && !p.moved && !this.state.isPenToggled && !this.isMomentaryDraw) {
      if (Date.now() - p.startTime < 250) {
        this.client.sendTap({ source: 'touchpad' });
      }
    }

    if (this.touchStartCount === 2 && !this.twoFingerTapDetected && this.activePointers.size === 0) {
      if (Date.now() - this.touchStartTime < 350) {
        this.client.sendTap({ source: 'two_finger' });
        this.twoFingerTapDetected = true;
      }
    }

    if (this.activePointers.size < 2 && this.isMomentaryDraw) {
      this.isMomentaryDraw = false;
      this._syncUi();
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Broadcasting
  // ---------------------------------------------------------------------------

  _broadcastStrokeStart(key) {
    if (this.activeStrokeIds.has(key)) return;
    if (this.state.mode === 'type') return;

    const strokeId = `str-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.activeStrokeIds.set(key, strokeId);
    
    let tool = this.state.mode === 'erase' ? 'eraser' : 'pen';
    if (this.state.mode === 'pan') tool = 'pan';

    this.client.sendCustomEvent({
      eventName: 'draw:strokeStart',
      payload: { id: strokeId, tool, color: this.state.color, lineWidth: this.state.lineWidth }
    });
  }

  _broadcastStrokeEnd(key) {
    const id = this.activeStrokeIds.get(key);
    if (id) {
      this.client.sendCustomEvent({ eventName: 'draw:strokeEnd', payload: { id } });
      this.activeStrokeIds.delete(key);
    }
  }

  _broadcastMode() { this.client.sendCustomEvent({ eventName: 'draw:mode', payload: { mode: this.state.mode } }); }
  _broadcastColor() { this.client.sendCustomEvent({ eventName: 'draw:color', payload: { color: this.state.color } }); }
  _broadcastSize() { this.client.sendCustomEvent({ eventName: 'draw:size', payload: { lineWidth: this.state.lineWidth } }); }
  _broadcastUndo() { this.client.sendCustomEvent({ eventName: 'draw:undo', payload: {} }); }
  _broadcastClear() { this.client.sendCustomEvent({ eventName: 'draw:clear', payload: {} }); }

  _broadcastAll() {
    this._broadcastMode();
    this._broadcastColor();
    this._broadcastSize();
  }

  // ---------------------------------------------------------------------------
  // 5. Store Logic
  // ---------------------------------------------------------------------------
  
  _initStore() {
    // 1. Register Slice
    this.store.registerSlice(TOOLS_SLICE, this.state);
    
    // 2. Subscribe (Bi-Directional Sync)
    this.unsubscribeStore = this.store.subscribe(TOOLS_SLICE, (newState) => {
      // Merge updates from external sources (e.g. Unicast event from Kiosk)
      this.state = { ...this.state, ...newState };
      this._syncUi();
    });
  }

  _updateStore() {
    if (this.store) this.store.setState(TOOLS_SLICE, this.state);
  }
}
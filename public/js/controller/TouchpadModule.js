// webtouch-sdk/public-js/controller/TouchpadModule.js

export class TouchpadModule {
  /**
   * @param {Object} options
   * @param {Object} options.controllerClient - WebTouch controller client.
   * @param {HTMLElement} options.parent - Container element to render into.
   * @param {boolean} [options.enablePointerLock=false] - Enable desktop pointer lock mode.
   */
  constructor({ controllerClient, parent, enablePointerLock = false } = {}) {
    if (!controllerClient) {
      throw new Error('TouchpadModule: controllerClient is required.');
    }
    if (!parent) {
      throw new Error('TouchpadModule: parent container is required.');
    }

    this.client = controllerClient;
    this.parent = parent;
    this.enablePointerLock = !!enablePointerLock;

    // Pointer state
    this.activePointers = new Map();

    // Two-finger tap state
    this.touchStartCount_2f = 0;
    this.touchStartTime_2f = 0;
    this.twoFingerTapDetected = false;

    // Pointer-lock state & references (saved for cleanup)
    this._isPointerLocked = false;
    this._onDblClick = null;
    this._onPointerLockChange = null;
    this._onMouseMoveWhileLocked = null;

    // Render #touchSurface
    this.touchElement = this._render();
    this.parent.appendChild(this.touchElement);

    this._attachPointerListeners();
    this._attachTouchListeners();

    if (this.enablePointerLock) {
      this._attachPointerLockSupport();
    }
  }

  /**
   * Cleanup method to remove global listeners and DOM elements.
   * Essential for SPA routing.
   */
  destroy() {
    // 1. Remove Global Listeners (Pointer Lock)
    if (this.enablePointerLock && typeof document !== 'undefined') {
      if (this._onPointerLockChange) {
        document.removeEventListener('pointerlockchange', this._onPointerLockChange);
      }
      if (this._onMouseMoveWhileLocked) {
        document.removeEventListener('mousemove', this._onMouseMoveWhileLocked);
      }
    }

    // 2. Remove DOM
    if (this.touchElement && this.touchElement.parentNode) {
      this.touchElement.parentNode.removeChild(this.touchElement);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  _render() {
    const el = document.createElement('div');
    el.id = 'touchSurface';

    // Ensure it fills the controller UI wrapper
    el.style.flexGrow = '1';

    el.innerHTML = `
      <div id="introAnimation">
        <div id="animHand">👆</div>
        <div id="animDot"></div>
        <p>Touch and drag here</p>
      </div>
    `;

    this.touchpadEl = el;
    return el;
  }

  // ---------------------------------------------------------------------------
  // Pointer events (movement + single taps)
  // ---------------------------------------------------------------------------

  _attachPointerListeners() {
    const el = this.touchpadEl;
    if (!el) return;

    el.style.touchAction = 'none';

    const intro = el.querySelector('#introAnimation');
    const hideIntro = () => {
      if (intro) intro.classList.add('hidden');
    };
    // Hide animation on first pointer interaction
    el.addEventListener('pointerdown', hideIntro, { once: true });

    el.addEventListener('pointerdown', (event) => this._handlePointerDown(event));
    el.addEventListener('pointermove', (event) => this._handlePointerMove(event));
    el.addEventListener('pointerup', (event) => this._handlePointerUp(event));
    el.addEventListener('pointercancel', (event) => this._handlePointerUp(event));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _handlePointerDown(event) {
    if (event.button === 2) {
      event.preventDefault();
      this.client.sendTap({ source: 'pointer_button_right' });
      return;
    }

    this.activePointers.set(event.pointerId, {
      startX: event.clientX,
      startY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY,
      startTime: performance.now(),
      moved: false,
    });

    try {
      this.touchpadEl.setPointerCapture(event.pointerId);
    } catch (e) {}
    event.preventDefault();
  }

  _handlePointerMove(event) {
    const pointerState = this.activePointers.get(event.pointerId);
    if (!pointerState) return;

    event.preventDefault();

    const deltaX = event.clientX - pointerState.prevX;
    const deltaY = event.clientY - pointerState.prevY;

    if (deltaX !== 0 || deltaY !== 0) {
      pointerState.moved = true;
      this.client.sendCursorMove({ deltaX, deltaY });
      pointerState.prevX = event.clientX;
      pointerState.prevY = event.clientY;
    }
  }

  _handlePointerUp(event) {
    const pointerState = this.activePointers.get(event.pointerId);
    if (!pointerState) return;

    event.preventDefault();

    const duration = performance.now() - pointerState.startTime;
    const distX = event.clientX - pointerState.startX;
    const distY = event.clientY - pointerState.startY;
    const movedDistanceSq = distX * distX + distY * distY;

    const TAP_MAX_DURATION = 250;
    const TAP_MAX_DIST_SQ = 15 * 15;

    // Tap detection
    if (
      !pointerState.moved &&
      duration <= TAP_MAX_DURATION &&
      movedDistanceSq <= TAP_MAX_DIST_SQ
    ) {
      this.client.sendTap({ source: 'touchpad' });
    }

    try {
      if (this.touchpadEl.hasPointerCapture(event.pointerId)) {
        this.touchpadEl.releasePointerCapture(event.pointerId);
      }
    } catch (e) {}
    this.activePointers.delete(event.pointerId);
  }

  // ---------------------------------------------------------------------------
  // Touch events (two-finger tap detection)
  // ---------------------------------------------------------------------------

  _attachTouchListeners() {
    const el = this.touchpadEl;
    if (!el || !('ontouchstart' in window)) return;

    el.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
    el.addEventListener('touchend', (e) => this._handleTouchEnd(e), { passive: false });
    el.addEventListener('touchcancel', (e) => this._handleTouchEnd(e), { passive: false });
  }

  _handleTouchStart(event) {
    if (event.touches.length === 2) {
      this.touchStartCount_2f = 2;
      this.touchStartTime_2f = Date.now();
      this.twoFingerTapDetected = false;
    }
  }

  _handleTouchEnd(event) {
    if (
      this.touchStartCount_2f === 2 &&
      !this.twoFingerTapDetected &&
      event.touches.length < 2
    ) {
      const elapsed = Date.now() - this.touchStartTime_2f;
      if (elapsed < 350) {
        this.client.sendTap({ source: 'two_finger' });
        this.twoFingerTapDetected = true;
        event.preventDefault();
      }
    }

    if (event.touches.length === 0) {
      this.touchStartCount_2f = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Pointer lock support (optional, desktop only)
  // ---------------------------------------------------------------------------

  _attachPointerLockSupport() {
    const pad = this.touchpadEl;
    if (!pad || typeof document === 'undefined') return;

    // Double-click to toggle pointer lock
    this._onDblClick = async () => {
      try {
        if (!this._isPointerLocked) {
          if (pad.requestPointerLock) await pad.requestPointerLock();
        } else {
          if (document.exitPointerLock) document.exitPointerLock();
        }
      } catch (err) {
        console.warn('TouchpadModule: pointerLock request failed:', err);
      }
    };

    pad.addEventListener('dblclick', this._onDblClick);

    // Save reference for cleanup
    this._onPointerLockChange = () => {
      const lockedElement =
        document.pointerLockElement ||
        document.mozPointerLockElement ||
        document.webkitPointerLockElement;

      const locked = lockedElement === pad;
      this._isPointerLocked = locked;
      pad.classList.toggle('webtouch-pointer-locked', locked);
    };

    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    // Save reference for cleanup
    this._onMouseMoveWhileLocked = (e) => {
      if (!this._isPointerLocked) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      if (dx !== 0 || dy !== 0) {
        this.client.sendCursorMove({ deltaX: dx, deltaY: dy });
      }
    };

    document.addEventListener('mousemove', this._onMouseMoveWhileLocked);
  }
}
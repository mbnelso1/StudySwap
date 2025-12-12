// public-js/sdk/webTouchBridge.js

/**
 * WebTouch Bridge
 *
 * Acts as the adapter layer between the WebTouch App Client (Socket.IO wrapper)
 * and the browser DOM. It handles the "physical" manifestations of the remote
 * interaction.
 * 
 */

import { createAppClient } from './webTouchClient.js';

const SESSION_STORAGE_KEY = 'webTouchRoomCode';
const SENSITIVITY = 2.0; // Speed multiplier for remote cursor movement

/**
 * Initializes the WebTouch bridge.
 *
 * @param {Object} options
 * @param {HTMLElement} options.cursorElement - DOM element for the shared cursor.
 * @param {HTMLElement} options.qrCodeContainer - DOM element for QR code.
 * @param {boolean} [options.manageCursor=true] - If true, Bridge moves the DOM cursor automatically. If false, it ignores inputs (for multi-user apps).
 * @param {function(number, number):void} [options.onCursorPosChange] - Callback for single-user cursor updates.
 * @param {function(string, any, string):void} [options.onCustomEvent] - Callback for custom events.
 */
export function initWebTouchBridge({
  cursorElement,
  qrCodeContainer,
  manageCursor = true, // <--- NEW: Defaults to true for backward compatibility
  onCursorPosChange,
  onCustomEvent,
} = {}) {
  // --- Input Validation ---
  if (!cursorElement) {
    throw new Error('WebTouchBridge: cursorElement is required to initialize.');
  }
  if (!qrCodeContainer) {
    throw new Error('WebTouchBridge: qrCodeContainer is required to initialize.');
  }

  // --- Internal State ---
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  let currentRoomCode = null;
  
  // Track focused/hovered elements (Only relevant in Single User / manageCursor mode)
  let hoveredElement = null;
  let focusedElement = null;

  const appState = {
    cursor: { x: cursorX, y: cursorY },
    hover: null,
    focus: null,
  };

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function buildControllerUrl(roomCode) {
    const url = new URL(window.location.href);
    url.pathname = '/controller';
    url.searchParams.set('room', roomCode);
    return url.toString();
  }

  function renderQrAndRoomCode(roomCode) {
    if (!roomCode) return;
    qrCodeContainer.innerHTML = '';

    const controllerUrl = buildControllerUrl(roomCode);
    const qrGlobal = (typeof window !== 'undefined' && window.QRCode) ? window.QRCode : undefined;
    let qrRendered = false;

    if (qrGlobal) {
      try {
        if (typeof qrGlobal === 'function') {
          new qrGlobal(qrCodeContainer, { text: controllerUrl, width: 128, height: 128 });
          qrRendered = true;
        } else if (typeof qrGlobal.toCanvas === 'function') {
          const canvas = document.createElement('canvas');
          qrCodeContainer.appendChild(canvas);
          qrGlobal.toCanvas(canvas, controllerUrl, { width: 128, margin: 1 }, () => {});
          qrRendered = true;
        }
      } catch (e) {
        console.error('WebTouchBridge: Failed to render QRCode:', e);
      }
    }

    if (!qrRendered) {
      const fallback = document.createElement('div');
      fallback.className = 'webtouch-qr-fallback';
      fallback.textContent = controllerUrl;
      qrCodeContainer.appendChild(fallback);
    }

    const label = document.createElement('div');
    label.className = 'webtouch-room-label';
    label.innerHTML = `
      <div><strong>Room:</strong> ${roomCode}</div>
      <div class="webtouch-url">${controllerUrl}</div>
    `;
    qrCodeContainer.appendChild(label);
  }

  function updateCursorDom() {
    cursorElement.style.left = `${cursorX}px`;
    cursorElement.style.top = `${cursorY}px`;
  }

  function updateHoverVisuals(el) {
    if (hoveredElement === el) return;
    if (hoveredElement) hoveredElement.classList.remove('webtouch-manual-hover');
    hoveredElement = el;
    if (hoveredElement) hoveredElement.classList.add('webtouch-manual-hover');
  }

  function updateFocusVisuals(el) {
    if (focusedElement === el) return;
    if (focusedElement) focusedElement.classList.remove('webtouch-manual-focus');
    focusedElement = el;
    if (focusedElement) focusedElement.classList.add('webtouch-manual-focus');
  }

  /**
   * Only called when manageCursor is true
   */
  function setCursorPosition(x, y) {
    cursorX = clamp(x, 0, window.innerWidth);
    cursorY = clamp(y, 0, window.innerHeight);

    updateCursorDom();
    
    // Hit testing
    const el = document.elementFromPoint(cursorX, cursorY) || null;
    updateHoverVisuals(el);
    appState.hover = el ? { tagName: el.tagName, id: el.id, className: el.className } : null;
    appState.cursor = { x: cursorX, y: cursorY };

    if (typeof onCursorPosChange === 'function') {
      onCursorPosChange(cursorX, cursorY);
    }
    
    client.reportAppState(appState);
  }

  function updateFocusFromDom(el) {
    if (!manageCursor) return; // Don't track DOM focus in multi-user mode
    updateFocusVisuals(el);
    appState.focus = el 
      ? { tagName: el.tagName, id: el.id, className: el.className, value: el.value } 
      : null;
    client.reportAppState(appState);
  }

  function performTapAction() {
    cursorElement.classList.add('clicking');
    setTimeout(() => cursorElement.classList.remove('clicking'), 200);

    const target = document.elementFromPoint(cursorX, cursorY);
    if (!target) return;

    if (
      target instanceof HTMLInputElement || 
      target instanceof HTMLTextAreaElement || 
      target.isContentEditable
    ) {
      target.focus();
      updateFocusFromDom(target);
    }

    const ev = new MouseEvent('click', { 
      bubbles: true, 
      cancelable: true, 
      clientX: cursorX, 
      clientY: cursorY 
    });
    target.dispatchEvent(ev);
  }

  // ---------------------------------------------------------------------------
  // WebTouch Client Initialization
  // ---------------------------------------------------------------------------

  const client = createAppClient();

  // --- Network Event Handlers ---

  client.onRoomId?.((roomCode) => {
    currentRoomCode = roomCode;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, roomCode);
    } catch (e) {}
    renderQrAndRoomCode(roomCode);
  });

  client.onRejoinFailed?.((failedRoomCode) => {
    try {
      if (sessionStorage.getItem(SESSION_STORAGE_KEY) === failedRoomCode) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {}
    client.registerNewRoom();
  });

  client.onInitialState?.((state) => {
    if (!state || !manageCursor) return;
    if (state.cursor) {
      cursorX = state.cursor.x || cursorX;
      cursorY = state.cursor.y || cursorY;
      updateCursorDom();
    }
  });

  client.onControllerPresenceChanged?.((info) => {
    // Only show the DOM cursor if we are managing it
    if (!manageCursor) return;
    
    const count = info ? info.controllerCount : 0;
    if (count > 0) {
      cursorElement.classList.add('visible');
    } else {
      cursorElement.classList.remove('visible');
    }
  });


  // --- Controller Input Handlers ---

  client.onCursorMove?.(({ deltaX, deltaY }, controllerId) => {
    // REFACTOR: If we aren't managing the cursor (Multi-User mode), ignore this.
    // The WebTouchApp will listen to client.onCursorMove directly.
    if (!manageCursor) return;

    const dx = (deltaX || 0) * SENSITIVITY;
    const dy = (deltaY || 0) * SENSITIVITY;
    setCursorPosition(cursorX + dx, cursorY + dy);
  });

  client.onTap?.((tapInfo, controllerId) => {
    if (!manageCursor) return;
    performTapAction();
  });

  // 🔹 NEW: handle remote key presses in DOM-bridge (single user) mode
  client.onKeyPress?.((payload, controllerId) => {
    if (!manageCursor) return; // in multi-user mode, WebTouchApp handles keys itself

    const { key } = payload || {};
    if (!key) return;

    const inputElement = document.activeElement;
    if (!inputElement || typeof inputElement.value === 'undefined') return;

    const { selectionStart: start, selectionEnd: end, value } = inputElement;

    if (key === 'Backspace') {
      const newStart = (start === end ? Math.max(0, start - 1) : start);
      inputElement.value =
        value.substring(0, newStart) + value.substring(end);
      inputElement.selectionStart = inputElement.selectionEnd = newStart;

    } else if (key === 'Enter' && inputElement.form && inputElement.tagName !== 'TEXTAREA') {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      inputElement.form.dispatchEvent(submitEvent);

    } else {
      const char = key === 'Enter' ? '\n' : key;
      inputElement.value =
        value.substring(0, start) + char + value.substring(end);
      inputElement.selectionStart = inputElement.selectionEnd = start + char.length;
    }

    // Let the page know the value changed (for validation, bindings, etc.)
    inputElement.dispatchEvent(
      new Event('input', { bubbles: true, cancelable: true })
    );
  });

  client.onCustomEvent?.((eventName, payload, controllerId) => {
    // Always pass custom events through, ensuring ID is included
    if (typeof onCustomEvent === 'function') {
      onCustomEvent(eventName, payload, controllerId);
    }
  });


  // ---------------------------------------------------------------------------
  // Lifecycle & DOM Binding
  // ---------------------------------------------------------------------------

  (function initRoom() {
    let lastRoomCode = null;
    try { lastRoomCode = sessionStorage.getItem(SESSION_STORAGE_KEY); } catch (e) {}

    if (lastRoomCode) client.rejoinRoom(lastRoomCode);
    else client.registerNewRoom();
  })();

  // DOM Event Listeners (only relevant if bridge manages focus state)
  if (manageCursor) {
    document.body.addEventListener('focusin', (e) => updateFocusFromDom(e.target));
    document.body.addEventListener('focusout', () => updateFocusFromDom(null));
    document.body.addEventListener('input', (e) => {
      if (e.target === focusedElement) updateFocusFromDom(e.target);
    });
    updateCursorDom();
  }

  client.getCursorPosition = () => ({ x: cursorX, y: cursorY });

  return client;
}
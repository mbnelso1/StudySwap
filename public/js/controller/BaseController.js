// public-js/controller/BaseController.js

import { createControllerClient } from '../sdk/webTouchClient.js';
import { createControllerStore } from './controllerStore.js';

const CONTROLLER_SESSION_KEY = 'webTouchLastRoomCode';

export class BaseController {
  /**
   * @param {string|HTMLElement} root
   *   Root element or selector where the controller shell should mount.
   * @param {Object} [options={}]
   *   Reserved for future use (e.g. serverUrl, theme).
   */
  constructor(root = '#controller-app', options = {}) {
    // 1. Resolve Root
    if (typeof root === 'string') {
      this.rootElement = document.querySelector(root);
    } else {
      this.rootElement = root;
    }
    if (!this.rootElement) {
      throw new Error(
        'BaseController: The provided root element or selector was not found in the DOM.'
      );
    }

    // 2. Initialize Client & Store
    const clientOptions = {};
    if (options.serverUrl) {
      clientOptions.serverUrl = options.serverUrl;
    }
    this.client = createControllerClient(clientOptions);
    this.store = createControllerStore();
    this.currentRoomCode = null;

    // 3. Render Shell
    this._render();

    // 4. Cache DOM Elements
    this.joinForm = this.rootElement.querySelector('#manualJoinForm');
    this.roomIdInput = this.rootElement.querySelector('#manualRoomIdInput');
    this.joinButton = this.rootElement.querySelector('#joinManualRoomButton');
    this.statusMessage = this.rootElement.querySelector('#statusMessage');
    this.controllerUiWrapper = this.rootElement.querySelector('#controllerUiWrapper');

    // 5. Bind Event Handlers (Saved references for cleanup)
    this._handleJoinClick = () => this.attemptToJoinRoom(this.roomIdInput.value);
    this._handleInputKeypress = (e) => {
      if (e.key === 'Enter') this.attemptToJoinRoom(this.roomIdInput.value);
    };
    this._handleInputInput = (e) => {
      const { selectionStart, selectionEnd } = e.target;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(selectionStart, selectionEnd);
    };

    // 6. Initialize Logic
    this._initConnectionLogic();
    this._initJoinFormLogic();
  }

  /**
   * Where controller modules (Touchpad, DrawingTools, Keyboard) should render.
   */
  getModuleContainer() {
    return this.controllerUiWrapper;
  }

  /**
   * Expose the shared store so WebTouchController can reuse it.
   */
  getStore() {
    return this.store;
  }

  /**
   * Cleanup method for SPAs (React/Vue/etc).
   * Disconnects socket and removes event listeners.
   */
  destroy() {
    if (this.client && this.client.socket) {
      this.client.socket.disconnect();
    }

    if (this.joinButton) {
      this.joinButton.removeEventListener('click', this._handleJoinClick);
    }
    if (this.roomIdInput) {
      this.roomIdInput.removeEventListener('keypress', this._handleInputKeypress);
      this.roomIdInput.removeEventListener('input', this._handleInputInput);
    }

    this.rootElement.innerHTML = '';
  }

  _render() {
    this.rootElement.innerHTML = `
      <div id="manualJoinForm" style="display: none;">
        <label for="manualRoomIdInput">Room Code:</label>
        <input
          type="text"
          id="manualRoomIdInput"
          size="4"
          maxlength="4"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button id="joinManualRoomButton">Join</button>
      </div>

      <div id="controllerUiWrapper" style="display: none;">
        <!-- Modules will be injected here -->
      </div>

      <div id="statusMessage" style="display: block;">Connecting...</div>
    `;
  }

  _initConnectionLogic() {
    // A. Connected to Server (Socket open)
    this.client.onConnected(() => {
      const params = new URLSearchParams(window.location.search);
      const roomCodeFromUrl = params.get('room');
      const lastRoom = sessionStorage.getItem(CONTROLLER_SESSION_KEY);

      if (roomCodeFromUrl) {
        this.attemptToJoinRoom(roomCodeFromUrl);
      } else if (lastRoom) {
        this.attemptToJoinRoom(lastRoom);
      } else {
        this._showManualJoinUI('Please enter a Room Code.');
      }
    });

    // B. Joined Room Successfully
    this.client.onJoinSuccess((roomId) => {
      this.currentRoomCode = roomId;
      try {
        sessionStorage.setItem(CONTROLLER_SESSION_KEY, roomId);
      } catch (e) {
        console.warn('BaseController: failed to write sessionStorage', e);
      }

      this._setFormState(true); // Re-enable form for future use if disconnected
      this.statusMessage.textContent = `Connected to Room: ${roomId}`;
      this.statusMessage.style.backgroundColor = 'lightgreen';

      this.joinForm.style.display = 'none';
      this.controllerUiWrapper.style.display = 'flex';
      
      // Move status message to bottom
      this.controllerUiWrapper.appendChild(this.statusMessage);
      this.statusMessage.style.order = '99';
    });

    // C. Error States
    this.client.onInvalidRoom((code) => {
      this._setFormState(true); // Re-enable input
      this._showManualJoinUI(`Error: Invalid Room Code "${code}"`);
    });

    this.client.onDisconnected((reason) => {
      this._setFormState(true);
      this._showManualJoinUI(`Disconnected: ${reason || 'Lost connection'}`);
    });

    this.client.onAppDisconnected(() => {
      this._showManualJoinUI(`Room "${this.currentRoomCode}" was closed.`);
    });

    this.client.onAppReconnected(() => {
      if (!this.currentRoomCode) return;
      this.statusMessage.textContent = `Reconnected to Room: ${this.currentRoomCode}`;
      this.statusMessage.style.backgroundColor = 'lightgreen';
    });

    // D. Auto-Refresh Logic (when Kiosk app switches)
    this.client.onControllerRefresh(({ roomCode }) => {
      const code = roomCode || this.currentRoomCode;
      if (!code) return;

      try {
        sessionStorage.setItem(CONTROLLER_SESSION_KEY, code);
      } catch (e) {}

      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.location.href = url.toString();
    });
  }

  _showManualJoinUI(msg) {
    this.currentRoomCode = null;

    this.joinForm.style.display = 'block';
    this.controllerUiWrapper.style.display = 'none';

    // Move status bar above the join form when "disconnected"
    this.rootElement.insertBefore(this.statusMessage, this.joinForm);
    this.statusMessage.textContent = msg;
    this.statusMessage.style.backgroundColor = 'lightcoral';

    try {
      sessionStorage.removeItem(CONTROLLER_SESSION_KEY);
    } catch (e) {}

    this.roomIdInput.focus();
  }

  _initJoinFormLogic() {
    this.joinButton.addEventListener('click', this._handleJoinClick);
    this.roomIdInput.addEventListener('keypress', this._handleInputKeypress);
    this.roomIdInput.addEventListener('input', this._handleInputInput);
  }

  /**
   * Helper to disable/enable form inputs while connecting
   * @param {boolean} enabled 
   */
  _setFormState(enabled) {
    this.roomIdInput.disabled = !enabled;
    this.joinButton.disabled = !enabled;
    this.joinButton.textContent = enabled ? 'Join' : '...';
  }

  attemptToJoinRoom(roomCode) {
    const code = String(roomCode || '').trim().toUpperCase();
    if (code.length !== 4) {
      this._showManualJoinUI('Enter a valid 4-letter code.');
      return;
    }

    // UX: Disable input to prevent double-submit
    this._setFormState(false);

    this.statusMessage.textContent = `Joining ${code}...`;
    this.statusMessage.style.backgroundColor = '#ddd';

    this.client.joinRoom(code);
  }
}
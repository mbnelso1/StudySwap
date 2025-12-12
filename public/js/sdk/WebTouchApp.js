// public-js/sdk/WebTouchApp.js

import { initWebTouchBridge } from './webTouchBridge.js';

/**
 * WebTouchApp
 * 
 * The base class for Kiosk/Public display applications.
 * 
 * Modes:
 * 1. Single-User (Default): 
 *    - Aggregates all inputs into one shared cursor.
 *    - Automatically handles the DOM cursor element.
 *    - Best for: Menus, simple navigation.
 * 
 * 2. Multi-User (multiUser: true):
 *    - Maintains a collection (Map) of distinct cursors.
 *    - Hides the default DOM cursor (you render cursors yourself, e.g., on Canvas).
 *    - Provides the `onPlayerUpdate` hook for rendering.
 *    - Enables unicast communication via `user.send()`.
 *    - Best for: Whiteboards, games, collaborative tools.
 */
export class WebTouchApp {
  /**
   * @param {Object} config
   * @param {string} [config.appRootSelector='#app-root'] - Main container.
   * @param {string} [config.cursorSelector='#cursor'] - DOM element for the shared cursor.
   * @param {string} [config.qrSelector='#qrCodeContainer'] - Container for the QR code.
   * @param {boolean} [config.multiUser=false] - If true, enables Multi-User Cursor Management.
   */
  constructor({
    appRootSelector = '#app-root',
    cursorSelector = '#cursor',
    qrSelector = '#qrCodeContainer',
    multiUser = false,
  } = {}) {
    // 1. Element Validation
    const appRoot = document.querySelector(appRootSelector);
    const cursorElement = document.querySelector(cursorSelector);
    const qrCodeContainer = document.querySelector(qrSelector);

    if (!appRoot) throw new Error(`WebTouchApp: appRoot "${appRootSelector}" not found`);
    if (!cursorElement) throw new Error(`WebTouchApp: cursor "${cursorSelector}" not found`);
    if (!qrCodeContainer) throw new Error(`WebTouchApp: qrCode "${qrSelector}" not found`);

    // 2. State Initialization
    this.isMultiUser = multiUser;
    
    // The source of truth for Multi-User mode.
    // Map<controllerId, { id, x, y, data, send() }>
    this._cursors = new Map();

    // Context passed to hooks
    this._ctx = { appRoot, cursorElement, qrCodeContainer, client: null };

    // 3. Initialize Bridge
    // If Multi-User, we silence the bridge's default DOM cursor logic (onCursorPosChange: null)
    // because the App class will handle the physics and state internally.
    const client = initWebTouchBridge({
      cursorElement,
      qrCodeContainer,
      
      // SINGLE USER: Bridge updates DOM. MULTI USER: We handle it manually below.
      onCursorPosChange: this.isMultiUser ? null : (x, y) => {
        if (typeof this.onCursorMove === 'function') {
          this.onCursorMove(x, y, this._ctx);
        }
      },

      // ALL MODES: Route custom events with ID
      onCustomEvent: (eventName, payload, id) => {
        if (typeof this.onCustomEvent === 'function') {
          this.onCustomEvent(eventName, payload, id, this._ctx);
        }
      },
    });

    this.client = client;
    this._ctx.client = client;

    // 4. Input Routing (Tap/Key)
    if (client.onKeyPress) {
      client.onKeyPress((evt, id) => {
        if (typeof this.onKeyPress === 'function') this.onKeyPress(evt, id, this._ctx);
      });
    }

    if (client.onTap) {
      client.onTap((evt, id) => {
        if (typeof this.onTap === 'function') this.onTap(evt, id, this._ctx);
      });
    }

    // 5. Multi-User Logic Implementation
    if (this.isMultiUser) {
      this._initMultiUserLogic();
    }

    // 6. Lifecycle Start
    if (typeof this.onInit === 'function') {
      this.onInit(this._ctx);
    }
  }

  /**
   * Internal setup for Multi-User state management.
   * Handles physics, connection state, and unicast helper generation.
   * @private
   */
  _initMultiUserLogic() {
    const { cursorElement } = this._ctx;
    
    // Hide the default shared cursor (App renders specific user cursors)
    if (cursorElement) cursorElement.style.display = 'none';

    // MOVEMENT: Handle raw input, apply physics, update Map
    this.client.onCursorMove((payload, id) => {
      const cursor = this._getOrCreateCursor(id);
      const SENSITIVITY = 2.0;

      // Apply movement delta
      cursor.x += (payload.deltaX || 0) * SENSITIVITY;
      cursor.y += (payload.deltaY || 0) * SENSITIVITY;

      // Clamp to screen bounds
      cursor.x = Math.max(0, Math.min(window.innerWidth, cursor.x));
      cursor.y = Math.max(0, Math.min(window.innerHeight, cursor.y));

      // Notify App
      if (typeof this.onPlayerUpdate === 'function') {
        this.onPlayerUpdate(this._cursors, id, this._ctx);
      }
    });

    // DISCONNECT: Clean up Map
    this.client.onControllerDisconnected((id) => {
      if (this._cursors.has(id)) {
        this._cursors.delete(id);
        if (typeof this.onPlayerUpdate === 'function') {
          this.onPlayerUpdate(this._cursors, id, this._ctx);
        }
      }
    });
  }

  /**
   * Internal helper to retrieve or create a tracked cursor object.
   * Attaches the `send()` method for unicast communication.
   * @private
   */
  _getOrCreateCursor(id) {
    if (!this._cursors.has(id)) {
      this._cursors.set(id, {
        id: id,
        // Start at center
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        // Bag for custom app data (score, color, team, etc.)
        data: {},
        
        /**
         * Send a custom event ONLY to this specific controller.
         * @param {string} eventName 
         * @param {object} payload 
         */
        send: (eventName, payload) => {
          if (this.client.sendEventToController) {
            this.client.sendEventToController(id, { eventName, payload });
          } else {
            console.warn('WebTouchApp: Client does not support sendEventToController');
          }
        }
      });
    }
    return this._cursors.get(id);
  }

  /**
   * Convenience method to update custom data on a user cursor.
   * @param {string} id - Controller ID
   * @param {object} partialData - Data to merge into cursor.data
   * @returns {object|null} The updated cursor object
   */
  updateCursorData(id, partialData) {
    if (!this.isMultiUser) return null;
    const cursor = this._getOrCreateCursor(id);
    cursor.data = { ...cursor.data, ...partialData };
    return cursor;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Hooks (Override these in your App)
  // ---------------------------------------------------------------------------

  /**
   * Called once on startup. Use to build DOM/Canvas.
   * @param {object} ctx - { appRoot, client, ... }
   */
  onInit(ctx) {}

  /**
   * [MULTI-USER ONLY]
   * Called whenever a user moves, joins, leaves, or updates data.
   * Use this to render your game loop or canvas.
   * 
   * @param {Map} cursorMap - The Map<id, cursor> of all active users.
   * @param {string} changedId - The ID of the user who triggered the update.
   * @param {object} ctx
   */
  onPlayerUpdate(cursorMap, changedId, ctx) {}

  /**
   * [SINGLE-USER ONLY]
   * Called when the shared cursor moves.
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {object} ctx
   */
  onCursorMove(x, y, ctx) {}

  /**
   * Called when a controller sends a custom event (e.g., 'draw:color').
   * @param {string} name 
   * @param {any} payload 
   * @param {string} id - The Controller ID
   * @param {object} ctx
   */
  onCustomEvent(name, payload, id, ctx) {}

  /**
   * Called when a controller types.
   * @param {object} event - { key: 'a' }
   * @param {string} id 
   * @param {object} ctx
   */
  onKeyPress(event, id, ctx) {}

  /**
   * Called on tap/click.
   * @param {object} event - { source: 'touchpad' }
   * @param {string} id 
   * @param {object} ctx
   */
  onTap(event, id, ctx) {}
}
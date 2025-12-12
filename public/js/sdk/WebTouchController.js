// public-js/sdk/WebTouchController.js

import { BaseController } from '../controller/BaseController.js';

/**
 * WebTouchController
 * 
 * Base class for Personal Controller apps (Phone/Tablet).
 * 
 * Responsibilities:
 * - Initializes the connection shell (BaseController).
 * - Manages the UI container.
 * - routes incoming App events to the `onAppEvent` hook.
 */
export class WebTouchController {
  /**
   * @param {string|HTMLElement} [root='#controller-app']
   *   Root element or CSS selector where the controller shell should mount.
   * @param {Object} [options={}]
   *   Optional configuration (e.g. serverUrl, theme, debug flags).
   */
  constructor(root = '#controller-app', options = {}) {
    // 1. Initialize Base Shell (Connection logic, Join form, etc.)
    this.base = new BaseController(root, options);

    // 2. Extract shared resources
    this.client = this.base.client;
    this.store = typeof this.base.getStore === 'function' ? this.base.getStore() : null;

    // 3. Resolve the Module Container
    this.container = typeof this.base.getModuleContainer === 'function'
        ? this.base.getModuleContainer()
        : typeof root === 'string'
          ? document.querySelector(root)
          : root;

    // 4. Create Context
    this._ctx = {
      rootSelector: typeof root === 'string' ? root : null,
      rootElement: this.base.rootElement,
      container: this.container,
      client: this.client,
      store: this.store,
      base: this.base,
      options,
    };

    // 5. Automatic Event Wiring (New Feature)
    // Allows subclasses to just define `onAppEvent(name, payload)` 
    // instead of manually binding client listeners in buildUI.
    if (this.client && this.client.onAppEvent) {
      this.client.onAppEvent((name, payload) => {
        if (typeof this.onAppEvent === 'function') {
          this.onAppEvent(name, payload, this._ctx);
        }
      });
    }

    // 6. Build UI
    if (typeof this.buildUI === 'function' && this.container) {
      this.buildUI(this.container, this.client, this.store, this._ctx);
    }
  }

  /**
   * Lifecycle Hook: Build your Controller UI here.
   * Instantiate modules (Touchpad, Keyboard) or add custom DOM elements.
   *
   * @param {HTMLElement} container - The div where modules should sit.
   * @param {Object} client - The network client for sending data.
   * @param {Object} store - Shared state store.
   * @param {Object} ctx - Full context object.
   */
  buildUI(container, client, store, ctx) {}

  /**
   * Lifecycle Hook: Handle events sent FROM the Kiosk App.
   * This receives both Broadcasts and Unicast (user.send) messages.
   * 
   * @param {string} eventName 
   * @param {any} payload 
   * @param {Object} ctx 
   */
  onAppEvent(eventName, payload, ctx) {}
}
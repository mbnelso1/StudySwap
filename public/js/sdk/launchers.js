// public-js/sdk/launchers.js
// Convenience launchers for WebTouch apps.
//
// These provide a configuration-object style API (similar to Phaser/React)
// allowing developers to launch apps without manually instantiation.
//
// Usage:
//   import { launchWebTouchApp, launchWebTouchController } from 'webtouch-sdk';
//
//   launchWebTouchApp({ 
//     AppClass: MyKioskApp, 
//     multiUser: true,              // <--- Enable Multi-User Mode here
//     selectors: { appRoot: '#game' } 
//   });
//
//   launchWebTouchController({ 
//     ControllerClass: MyController 
//   });

import { WebTouchApp } from './WebTouchApp.js';
import { WebTouchController } from './WebTouchController.js';

/**
 * Launch a kiosk/public app that extends WebTouchApp.
 *
 * @param {Object} config
 * @param {typeof WebTouchApp} [config.AppClass=WebTouchApp]
 *   Constructor to instantiate (must extend WebTouchApp).
 * @param {boolean} [config.multiUser=false]
 *   If true, enables Multi-User mode (managed cursor collection).
 *   If false (default), enables Single-User mode (shared DOM cursor).
 * @param {Object} [config.selectors]
 *   DOM selector overrides.
 * @param {string} [config.selectors.appRoot='#app-root']
 * @param {string} [config.selectors.cursor='#cursor']
 * @param {string} [config.selectors.qr='#qrCodeContainer']
 * @param {...any} [config.options]
 *   Any extra properties in `config` are forwarded to the AppClass constructor.
 *
 * @returns {WebTouchApp} The initialized app instance.
 */
export function launchWebTouchApp(config = {}) {
  const {
    AppClass = WebTouchApp,
    selectors = {},
    ...options // Captures multiUser and other custom options
  } = config;

  const {
    appRoot = '#app-root',
    cursor = '#cursor',
    qr = '#qrCodeContainer',
  } = selectors;

  // Pass everything to the constructor.
  // This allows subclasses to receive custom config via the launcher.
  const instance = new AppClass({
    appRootSelector: appRoot,
    cursorSelector: cursor,
    qrSelector: qr,
    ...options,
  });

  return instance;
}

/**
 * Launch a controller app that extends WebTouchController.
 *
 * @param {Object} config
 * @param {typeof WebTouchController} [config.ControllerClass=WebTouchController]
 *   Constructor to instantiate (must extend WebTouchController).
 * @param {string} [config.rootSelector='#controller-app']
 *   CSS selector for the root DOM element where the controller shell mounts.
 * @param {...any} [config.options]
 *   Any extra properties are forwarded to the ControllerClass constructor.
 *
 * @returns {WebTouchController} The initialized controller instance.
 */
export function launchWebTouchController(config = {}) {
  const {
    ControllerClass = WebTouchController,
    rootSelector = '#controller-app',
    ...options
  } = config;

  const instance = new ControllerClass(rootSelector, options);
  return instance;
}
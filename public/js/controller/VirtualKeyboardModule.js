// public-js/controller/VirtualKeyboardModule.js
// CORE: A self-rendering, pluggable module that provides a full virtual keyboard.
//
// Usage:
//   const keyboard = new VirtualKeyboardModule({ controllerClient: client, parent: container });
//   // later...
//   keyboard.destroy();

export class VirtualKeyboardModule {
  /**
   * @param {Object} options
   * @param {Object} options.controllerClient - WebTouch controller client.
   * @param {HTMLElement} options.parent - Container element to render into.
   */
  constructor({ controllerClient, parent }) {
    if (!controllerClient) {
      throw new Error('VirtualKeyboardModule: controllerClient is required.');
    }
    if (!parent) {
      throw new Error('VirtualKeyboardModule: parent container is required.');
    }

    this.client = controllerClient;
    this.parent = parent;

    // --- Local State ---
    this.keyboardMode = 'letters';
    this.isShiftActive = false;

    // --- Bind Handler for Cleanup ---
    this._handleClick = this._handleClick.bind(this);

    // --- Render and Attach ---
    this.keyboardElement = this._render();
    this.parent.appendChild(this.keyboardElement);

    // --- Cache DOM Elements ---
    this.layers = {
      letters: this.keyboardElement.querySelector('#layer-letters'),
      numbers: this.keyboardElement.querySelector('#layer-numbers'),
      symbols2: this.keyboardElement.querySelector('#layer-symbols2'),
    };
    this.shiftKey = this.keyboardElement.querySelector('#shiftLetters');
    this.letterKeys = this.layers.letters
      ? Array.from(
          this.layers.letters.querySelectorAll('.keyboard-key[data-key]')
        )
      : [];

    // --- Initialize ---
    this._initListeners();
    this._updateDisplay();
  }

  /**
   * Cleanup method to remove DOM and listeners.
   */
  destroy() {
    // 1. Remove Listener
    if (this.keyboardElement) {
      this.keyboardElement.removeEventListener('click', this._handleClick);
    }

    // 2. Remove DOM
    if (this.keyboardElement && this.keyboardElement.parentNode) {
      this.keyboardElement.parentNode.removeChild(this.keyboardElement);
    }
  }

  /**
   * Generates the complete HTML structure for the virtual keyboard.
   * @returns {HTMLElement} The fully constructed keyboard element.
   * @private
   */
  _render() {
    const el = document.createElement('div');
    el.id = 'virtualKeyboard';
    // Ensures the keyboard maintains its height in a flex container.
    el.style.flexShrink = '0';

    el.innerHTML = `
      <!-- === Letters Layer === -->
      <div class="keyboard-layer active" id="layer-letters">
        <div class="keyboard-row">
          <button class="keyboard-key" data-key="q" data-shift="Q">q</button>
          <button class="keyboard-key" data-key="w" data-shift="W">w</button>
          <button class="keyboard-key" data-key="e" data-shift="E">e</button>
          <button class="keyboard-key" data-key="r" data-shift="R">r</button>
          <button class="keyboard-key" data-key="t" data-shift="T">t</button>
          <button class="keyboard-key" data-key="y" data-shift="Y">y</button>
          <button class="keyboard-key" data-key="u" data-shift="U">u</button>
          <button class="keyboard-key" data-key="i" data-shift="I">i</button>
          <button class="keyboard-key" data-key="o" data-shift="O">o</button>
          <button class="keyboard-key" data-key="p" data-shift="P">p</button>
        </div>
        <div class="keyboard-row" style="padding: 0 5%;">
          <button class="keyboard-key" data-key="a" data-shift="A">a</button>
          <button class="keyboard-key" data-key="s" data-shift="S">s</button>
          <button class="keyboard-key" data-key="d" data-shift="D">d</button>
          <button class="keyboard-key" data-key="f" data-shift="F">f</button>
          <button class="keyboard-key" data-key="g" data-shift="G">g</button>
          <button class="keyboard-key" data-key="h" data-shift="H">h</button>
          <button class="keyboard-key" data-key="j" data-shift="J">j</button>
          <button class="keyboard-key" data-key="k" data-shift="K">k</button>
          <button class="keyboard-key" data-key="l" data-shift="L">l</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-shift" id="shiftLetters">⇧</button>
          <button class="keyboard-key" data-key="z" data-shift="Z">z</button>
          <button class="keyboard-key" data-key="x" data-shift="X">x</button>
          <button class="keyboard-key" data-key="c" data-shift="C">c</button>
          <button class="keyboard-key" data-key="v" data-shift="V">v</button>
          <button class="keyboard-key" data-key="b" data-shift="B">b</button>
          <button class="keyboard-key" data-key="n" data-shift="N">n</button>
          <button class="keyboard-key" data-key="m" data-shift="M">m</button>
          <button class="keyboard-key key-backspace" data-key="Backspace">⌫</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-mode-switch" data-target-mode="numbers">?123</button>
          <button class="keyboard-key" data-key=",">,</button>
          <button class="keyboard-key key-space" data-key=" ">Space</button>
          <button class="keyboard-key" data-key=".">.</button>
          <button class="keyboard-key key-enter" data-key="Enter">⏎</button>
        </div>
      </div>

      <!-- === Numbers/Symbols Layer === -->
      <div class="keyboard-layer" id="layer-numbers">
        <div class="keyboard-row">
          <button class="keyboard-key" data-key="1">1</button>
          <button class="keyboard-key" data-key="2">2</button>
          <button class="keyboard-key" data-key="3">3</button>
          <button class="keyboard-key" data-key="4">4</button>
          <button class="keyboard-key" data-key="5">5</button>
          <button class="keyboard-key" data-key="6">6</button>
          <button class="keyboard-key" data-key="7">7</button>
          <button class="keyboard-key" data-key="8">8</button>
          <button class="keyboard-key" data-key="9">9</button>
          <button class="keyboard-key" data-key="0">0</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key" data-key="@">@</button>
          <button class="keyboard-key" data-key="#">#</button>
          <button class="keyboard-key" data-key="$">$</button>
          <button class="keyboard-key" data-key="_">_</button>
          <button class="keyboard-key" data-key="&">&amp;</button>
          <button class="keyboard-key" data-key="-">-</button>
          <button class="keyboard-key" data-key="+">+</button>
          <button class="keyboard-key" data-key="(">(</button>
          <button class="keyboard-key" data-key=")">)</button>
          <button class="keyboard-key" data-key="/">/</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-mode-switch" data-target-mode="symbols2">=\\&lt;</button>
          <button class="keyboard-key" data-key="*">*</button>
          <button class="keyboard-key" data-key='"'>"</button>
          <button class="keyboard-key" data-key="'">'</button>
          <button class="keyboard-key" data-key=":">:</button>
          <button class="keyboard-key" data-key=";">;</button>
          <button class="keyboard-key" data-key="!">!</button>
          <button class="keyboard-key" data-key="?">?</button>
          <button class="keyboard-key key-backspace" data-key="Backspace">⌫</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-mode-switch" data-target-mode="letters">ABC</button>
          <button class="keyboard-key" data-key=",">,</button>
          <button class="keyboard-key key-space" data-key=" ">Space</button>
          <button class="keyboard-key" data-key=".">.</button>
          <button class="keyboard-key key-enter" data-key="Enter">⏎</button>
        </div>
      </div>

      <!-- === Symbols Layer 2 === -->
      <div class="keyboard-layer" id="layer-symbols2">
        <div class="keyboard-row">
          <button class="keyboard-key" data-key="~">~</button>
          <button class="keyboard-key" data-key="\`">\`</button>
          <button class="keyboard-key" data-key="|">|</button>
          <button class="keyboard-key" data-key="×">×</button>
          <button class="keyboard-key" data-key="€">€</button>
          <button class="keyboard-key" data-key="£">£</button>
          <button class="keyboard-key" data-key="¥">¥</button>
          <button class="keyboard-key" data-key="^">^</button>
          <button class="keyboard-key" data-key="°">°</button>
          <button class="keyboard-key" data-key="=">=</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key" data-key="%">%</button>
          <button class="keyboard-key" data-key="©">©</button>
          <button class="keyboard-key" data-key="®">®</button>
          <button class="keyboard-key" data-key="™">™</button>
          <button class="keyboard-key" data-key="✓">✓</button>
          <button class="keyboard-key" data-key="[">[</button>
          <button class="keyboard-key" data-key="]">]</button>
          <button class="keyboard-key" data-key="{">{</button>
          <button class="keyboard-key" data-key="}">}</button>
          <button class="keyboard-key" data-key="\\">\\</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-mode-switch" data-target-mode="numbers">?123</button>
          <span class="keyboard-spacer"></span>
          <button class="keyboard-key key-backspace" data-key="Backspace">⌫</button>
        </div>
        <div class="keyboard-row">
          <button class="keyboard-key key-mode-switch" data-target-mode="letters">ABC</button>
          <button class="keyboard-key" data-key=",">,</button>
          <button class="keyboard-key key-space" data-key=" ">Space</button>
          <button class="keyboard-key" data-key=".">.</button>
          <button class="keyboard-key key-enter" data-key="Enter">⏎</button>
        </div>
      </div>
    `;

    return el;
  }

  /**
   * Attaches a single event listener to the keyboard container.
   * @private
   */
  _initListeners() {
    // Note: We use the bound reference created in constructor
    this.keyboardElement.addEventListener('click', this._handleClick);
  }

  /**
   * Handles a click event anywhere within the keyboard, updating local state
   * and sending events via the client SDK.
   * @param {MouseEvent} event
   * @private
   */
  _handleClick(event) {
    const target = event.target.closest('.keyboard-key');
    if (!target) return;

    // Logic for mode switching
    if (target.classList.contains('key-mode-switch')) {
      this.keyboardMode = target.dataset.targetMode;
      this.isShiftActive = false;
      this._updateDisplay();

    // Shift toggle
    } else if (target === this.shiftKey) {
      this.isShiftActive = !this.isShiftActive;
      this._updateDisplay();

    // Regular key presses
    } else if (target.dataset.key) {
      let key = target.dataset.key;
      if (this.isShiftActive && target.dataset.shift) {
        key = target.dataset.shift;
      }

      this.client.sendKeyPress({ key });

      // Auto-turn-off shift after typing a single char
      if (this.isShiftActive && key.length === 1) {
        this.isShiftActive = false;
        this._updateDisplay();
      }
    }

    if (navigator.vibrate) navigator.vibrate(50);
  }

  /**
   * Updates the keyboard's visual display based on the current local state.
   * @private
   */
  _updateDisplay() {
    // Show the correct layer
    Object.keys(this.layers).forEach((key) => {
      if (this.layers[key]) {
        this.layers[key].classList.toggle('active', key === this.keyboardMode);
      }
    });

    // Update character labels for shift state in letters mode
    if (this.keyboardMode === 'letters') {
      this.letterKeys.forEach((el) => {
        if (el.dataset.key.length === 1) {
          el.textContent =
            this.isShiftActive && el.dataset.shift
              ? el.dataset.shift
              : el.dataset.key;
        }
      });
    }

    // Update shift key's visual style
    if (this.shiftKey) {
      this.shiftKey.classList.toggle('active', this.isShiftActive);
    }
  }
}
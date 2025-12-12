// public-js/controller/controllerStore.js
// Tiny namespaced state store for controller-side apps.
//
// API:
//   const store = createControllerStore();
//   store.registerSlice('tools', { color: 'red' });
//   store.setState('tools', { color: 'blue' });
//   store.subscribe('tools', (state) => console.log(state));

/**
 * Create a new controller store instance.
 */
export function createControllerStore() {
  /**
   * Internal structure:
   * Map<string, { state: any, listeners: Set<Function> }>
   */
  const slices = new Map();

  function ensureSlice(namespace) {
    if (typeof namespace !== 'string' || !namespace) {
      throw new Error('ControllerStore: namespace must be a non-empty string');
    }
    if (!slices.has(namespace)) {
      slices.set(namespace, {
        state: undefined,
        listeners: new Set(),
      });
    }
    return slices.get(namespace);
  }

  return {
    /**
     * Register or initialize a slice of state under a namespace.
     * If the slice already exists with state, this returns the existing state
     * (First registration wins).
     *
     * @param {string} namespace
     * @param {any} initialState
     * @returns {any} current state
     */
    registerSlice(namespace, initialState) {
      const slice = ensureSlice(namespace);
      if (typeof slice.state === 'undefined') {
        slice.state = initialState;
      }
      return slice.state;
    },

    /**
     * Get current state for a namespace.
     * @param {string} namespace
     * @returns {any} state
     */
    getState(namespace) {
      const slice = slices.get(namespace);
      return slice ? slice.state : undefined;
    },

    /**
     * Update state for a namespace.
     *
     * @param {string} namespace
     * @param {Object|Function} patchOrUpdater
     *   - If a function: (prevState) => nextState
     *   - If an object: merged into prevState via shallow spread
     * @returns {any} nextState
     */
    setState(namespace, patchOrUpdater) {
      const slice = ensureSlice(namespace);
      const prev = slice.state;

      let next;
      if (typeof patchOrUpdater === 'function') {
        next = patchOrUpdater(prev);
      } else if (
        patchOrUpdater &&
        typeof patchOrUpdater === 'object' &&
        !Array.isArray(patchOrUpdater)
      ) {
        // Shallow merge for objects
        next = { ...(prev || {}), ...patchOrUpdater };
      } else {
        // Direct replacement for primitives/arrays
        next = patchOrUpdater;
      }

      slice.state = next;

      // Notify listeners
      slice.listeners.forEach((listener) => {
        try {
          listener(next);
        } catch (e) {
          console.error(`ControllerStore: Error in listener for "${namespace}"`, e);
        }
      });

      return next;
    },

    /**
     * Subscribe to changes for a namespace.
     *
     * @param {string} namespace
     * @param {Function} listener - (nextState) => void
     * @param {boolean} [fireImmediately=true] - If true, calls listener with current state on bind.
     * @returns {Function} unsubscribe
     */
    subscribe(namespace, listener, fireImmediately = true) {
      const slice = ensureSlice(namespace);
      slice.listeners.add(listener);

      // Trigger immediately so UI renders current state
      if (fireImmediately && typeof slice.state !== 'undefined') {
        try {
          listener(slice.state);
        } catch (e) {
          console.error(`ControllerStore: Error in immediate listener for "${namespace}"`, e);
        }
      }

      return () => {
        slice.listeners.delete(listener);
      };
    },

    /**
     * Removes a specific slice and its listeners.
     * Useful if a module unmounts.
     * @param {string} namespace
     */
    deleteSlice(namespace) {
      if (slices.has(namespace)) {
        slices.get(namespace).listeners.clear();
        slices.delete(namespace);
      }
    },

    /**
     * Clears all state and listeners.
     */
    destroy() {
      slices.forEach((slice) => slice.listeners.clear());
      slices.clear();
    }
  };
}
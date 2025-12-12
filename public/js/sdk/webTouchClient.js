// public-js/sdk/webTouchClient.js

/**
 * WebTouch Client SDK
 *
 * Provides a high-level abstraction over Socket.IO for building dual-screen
 * web experiences (Kiosk App + Personal Controller).
 *
 * REFACTOR UPDATE:
 * - Supports multiple listeners per event (Pub/Sub pattern).
 * - App-side input handlers receive a `controllerId` argument so
 *   multi-user apps (games, productivity tools) can distinguish users.
 */

/* eslint-env browser */
/* global io */

const EventNames = {
  CURSOR_MOVE: "core:cursor_move",
  TAP: "core:tap",
  KEY_PRESS: "core:key_press",
  BUTTON: "core:button",
};

/**
 * Helper to manage sets of listeners (Pub/Sub).
 * register(fn) returns an unsubscribe function.
 */
function createHandlerSet() {
  const listeners = new Set();
  const trigger = (...args) => listeners.forEach((fn) => fn(...args));
  const register = (fn) => {
    if (typeof fn === "function") listeners.add(fn);
    // Return unsubscribe function
    return () => listeners.delete(fn);
  };
  return { trigger, register };
}

// =============================================================================
// App-Side Client (Kiosk / Public View)
// =============================================================================

export function createAppClient({ serverUrl = undefined } = {}) {
  const socket = serverUrl ? io(serverUrl) : io();

  // Internal Event Registry (Sets instead of single functions)
  const events = {
    // Lifecycle
    onConnected: createHandlerSet(),
    onDisconnected: createHandlerSet(),
    onRoomId: createHandlerSet(),
    onRejoinFailed: createHandlerSet(),
    onInitialState: createHandlerSet(),
    onControllerPresenceChanged: createHandlerSet(),
    onControllerDisconnected: createHandlerSet(),
    onControllerJoined: createHandlerSet(),

    // Input
    onCursorMove: createHandlerSet(),
    onTap: createHandlerSet(),
    onKeyPress: createHandlerSet(),
    onButton: createHandlerSet(),
    onCustomEvent: createHandlerSet(),
  };

  let currentRoomId = null;

  // --- Socket.IO Event Wiring ---

  socket.on("connect", () => events.onConnected.trigger());
  socket.on("disconnect", (reason) => events.onDisconnected.trigger(reason));

  socket.on("your_room_id", (id) => {
    currentRoomId = id;
    events.onRoomId.trigger(id);
  });

  socket.on("initial_state", (state) =>
    events.onInitialState.trigger(state || {})
  );

  socket.on("rejoin_failed", () =>
    events.onRejoinFailed.trigger(currentRoomId)
  );

  socket.on("controller_presence_changed", (data) =>
    events.onControllerPresenceChanged.trigger(data || {})
  );

  socket.on("controller_disconnected", (payload) => {
    // payload may be { controllerId } or just id; support both
    const controllerId =
      (payload && payload.controllerId) || payload || null;
    events.onControllerDisconnected.trigger(controllerId);
  });

  socket.on("controller_joined", (payload) => {
    const controllerId =
      (payload && payload.controllerId) || payload || null;
    events.onControllerJoined.trigger(controllerId);
  });

  // --- Input Event Router ---
  // Hub emits: { eventName, payload, controllerId }
  // For backward compat, we also accept `from` as the controller id.
  socket.on("controller_event", ({ eventName, payload = {}, controllerId, from } = {}) => {
    if (!eventName) return;
    const cid = controllerId || from || null;

    switch (eventName) {
      case EventNames.CURSOR_MOVE:
        events.onCursorMove.trigger(payload, cid);
        break;
      case EventNames.TAP:
        events.onTap.trigger(payload, cid);
        break;
      case EventNames.KEY_PRESS:
        events.onKeyPress.trigger(payload, cid);
        break;
      case EventNames.BUTTON:
        events.onButton.trigger(payload, cid);
        break;
      default:
        events.onCustomEvent.trigger(eventName, payload, cid);
        break;
    }
  });

  // --- Public API ---

  return {
    socket,

    getRoomId: () => currentRoomId,

    registerNewRoom: () => socket.emit("register_app_room"),

    rejoinRoom: (roomId) => {
      if (roomId) socket.emit("rejoin_app_room", roomId);
    },

    // Let the app persist arbitrary state across rejoins
    reportAppState(state) {
      if (currentRoomId) {
        socket.emit("report_app_state", { roomId: currentRoomId, state });
      }
    },

    // Broadcast app -> all controllers in room
    sendEventToControllers({ eventName, payload = {} } = {}) {
      if (currentRoomId && eventName) {
        socket.emit("send_event_to_controllers", {
          roomId: currentRoomId,
          eventName,
          payload,
        });
      }
    },

    // Unicast app -> specific controller
    sendEventToController(targetId, { eventName, payload = {} } = {}) {
      if (currentRoomId && targetId && eventName) {
        socket.emit("send_event_to_controller", {
          roomId: currentRoomId,
          targetId,
          eventName,
          payload,
        });
      }
    },

    // Registration Methods (Additive!)
    onConnected: events.onConnected.register,
    onDisconnected: events.onDisconnected.register,
    onRoomId: events.onRoomId.register,
    onRejoinFailed: events.onRejoinFailed.register,
    onInitialState: events.onInitialState.register,
    onControllerPresenceChanged: events.onControllerPresenceChanged.register,
    onControllerDisconnected: events.onControllerDisconnected.register,
    onControllerJoined: events.onControllerJoined.register,

    // Input handlers receive (payload, controllerId)
    onCursorMove: events.onCursorMove.register,
    onTap: events.onTap.register,
    onKeyPress: events.onKeyPress.register,
    onButton: events.onButton.register,
    onCustomEvent: events.onCustomEvent.register,
  };
}

// =============================================================================
// Controller-Side Client (Phone / Tablet)
// =============================================================================

export function createControllerClient({ serverUrl = undefined } = {}) {
  const socket = serverUrl ? io(serverUrl) : io();

  // Registry for Controller
  const events = {
    onConnected: createHandlerSet(),
    onDisconnected: createHandlerSet(),
    onInvalidRoom: createHandlerSet(),
    onJoinSuccess: createHandlerSet(),
    onAppDisconnected: createHandlerSet(),
    onAppReconnected: createHandlerSet(),
    onControllerRefresh: createHandlerSet(),
    onAppEvent: createHandlerSet(),
  };

  let currentRoomId = null;

  // --- Socket.IO Event Wiring ---

  socket.on("connect", () => events.onConnected.trigger());
  socket.on("disconnect", (reason) => events.onDisconnected.trigger(reason));
  socket.on("invalid_room", (roomId) => events.onInvalidRoom.trigger(roomId));
  socket.on("app_disconnected", () => events.onAppDisconnected.trigger());
  socket.on("app_reconnected", () => events.onAppReconnected.trigger());

  socket.on("join_success", ({ roomId }) => {
    currentRoomId = roomId;
    events.onJoinSuccess.trigger(roomId);
  });

  socket.on("controller_refresh", (data) =>
    events.onControllerRefresh.trigger(data)
  );

  // Handle both broadcasts and unicast events from the app
  socket.on("app_event", ({ eventName, payload = {} } = {}) => {
    if (eventName) events.onAppEvent.trigger(eventName, payload);
  });

  function sendEventToApp({ eventName, payload = {} }) {
    if (currentRoomId && eventName) {
      socket.emit("send_event_to_app", {
        roomId: currentRoomId,
        eventName,
        payload,
      });
    }
  }

  // --- Public API ---

  return {
    socket,

    joinRoom: (roomId) => {
      currentRoomId = null;
      socket.emit(
        "register_controller_room",
        String(roomId || "").toUpperCase()
      );
    },

    // High-level convenience methods
    sendCursorMove(payload) {
      sendEventToApp({
        eventName: EventNames.CURSOR_MOVE,
        payload,
      });
    },
    sendTap(payload) {
      sendEventToApp({
        eventName: EventNames.TAP,
        payload,
      });
    },
    sendKeyPress(payload) {
      sendEventToApp({
        eventName: EventNames.KEY_PRESS,
        payload,
      });
    },
    sendButton(payload) {
      sendEventToApp({
        eventName: EventNames.BUTTON,
        payload,
      });
    },

    // Escape hatch for arbitrary events
    sendCustomEvent({ eventName, payload = {} } = {}) {
      // Prevent collisions with core event names
      if (!Object.values(EventNames).includes(eventName)) {
        sendEventToApp({ eventName, payload });
      }
    },

    // Registration (Additive)
    onConnected: events.onConnected.register,
    onDisconnected: events.onDisconnected.register,
    onInvalidRoom: events.onInvalidRoom.register,
    onJoinSuccess: events.onJoinSuccess.register,
    onAppDisconnected: events.onAppDisconnected.register,
    onAppReconnected: events.onAppReconnected.register,
    onControllerRefresh: events.onControllerRefresh.register,
    onAppEvent: events.onAppEvent.register,
  };
}

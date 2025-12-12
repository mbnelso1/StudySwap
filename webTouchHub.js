// lib/webTouchHub.js

/**
 * WebTouch Hub Server Module
 *
 * Attaches to a Socket.IO instance to provide room-based, generic event
 * relaying between a single "app" client and multiple "controller" clients.
 *
 * This hub is intentionally unopinionated about the content of events,
 * allowing for maximum flexibility in controller and app design.
 *
 * Key behaviors:
 * - One app (kiosk/public) + many controllers per room.
 * - Rooms are identified by a short, human-readable code (e.g. "ABCD").
 * - Rooms persist even if the app disconnects, so the app can rejoin
 *   and inherit the same room code.
 * - On app rejoin, all controllers in that room receive an
 *   `app_reconnected` and `controller_refresh` event so they can reload
 *   into the appropriate controller UI for the new app.
 * - Supports controller → app events (unicast).
 * - Supports app → controllers events (broadcast OR unicast).
 * - All controller → app events include a `controllerId` so apps can
 *   support multi-user experiences.
 */

const DEFAULT_OPTIONS = {
  codeLength: 4,
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  debug: false,
};

/**
 * Attach the WebTouch hub to an existing Socket.IO server.
 *
 * @param {import('socket.io').Server} io - A Socket.IO server instance.
 * @param {Object} [userOptions]
 * @param {number} [userOptions.codeLength=4] - Room code length.
 * @param {string} [userOptions.alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ'] - Characters for room codes.
 * @param {boolean} [userOptions.debug=false] - Enable verbose logging.
 * @returns {{ options: Object, roomStates: Map<string, any> }}
 */
export function attachWebTouchHub(io, userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const { codeLength, alphabet, debug } = options;

  const log = (...args) => {
    if (debug) console.log("[WebTouchHub]", ...args);
  };
  const warn = (...args) => console.warn("[WebTouchHub]", ...args);

  // ---------------------------------------------------------------------------
  // Room Code Generation
  // ---------------------------------------------------------------------------

  function generateRoomCode() {
    let code = "";
    for (let i = 0; i < codeLength; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  }

  // ---------------------------------------------------------------------------
  // Room State
  // ---------------------------------------------------------------------------

  /**
   * roomState shape:
   * {
   *   appSocketId: string | null,
   *   controllerSocketIds: Set<string>,
   *   lastKnownAppState: object,
   * }
   */
  const roomStates = new Map();

  function createInitialRoomState(appSocketId) {
    return {
      appSocketId,
      controllerSocketIds: new Set(),
      // Generic bucket for the app to store any state it wants persisted
      // across its own reconnects. The hub does not interpret this data.
      lastKnownAppState: {},
    };
  }

  function broadcastControllerPresence(roomCode) {
    const roomState = roomStates.get(roomCode);
    if (!roomState || !roomState.appSocketId) return;

    const controllerCount = roomState.controllerSocketIds.size;
    io.to(roomState.appSocketId).emit("controller_presence_changed", {
      controllerCount,
    });
  }

  // ---------------------------------------------------------------------------
  // Socket.IO Wiring
  // ---------------------------------------------------------------------------

  io.on("connection", (socket) => {
    log("Client connected:", socket.id);
    let currentRoomCode = null; // Used for disconnect cleanup

    // -------------------------------------------------------------------------
    // Disconnect Handling
    // -------------------------------------------------------------------------

    socket.on("disconnect", () => {
      log("Client disconnected:", socket.id, "from room:", currentRoomCode);
      if (!currentRoomCode) return;

      const roomState = roomStates.get(currentRoomCode);
      if (!roomState) return;

      // Case 1: The app (public/kiosk) disconnected.
      if (socket.id === roomState.appSocketId) {
        log(
          `App disconnected for room ${currentRoomCode}. Keeping room for rejoin.`
        );
        // Mark app as offline but keep the room and controllers.
        roomState.appSocketId = null;

        // Notify controllers the app is gone (they can show a "waiting" UI).
        roomState.controllerSocketIds.forEach((controllerSid) => {
          const controllerSocket = io.sockets.sockets.get(controllerSid);
          if (controllerSocket) {
            controllerSocket.emit("app_disconnected");
          }
        });

        // NOTE: We do NOT delete the room or remove controllers.
        // This allows the app to rejoin later using the same room code.
        return;
      }

      // Case 2: A controller disconnected.
      if (roomState.controllerSocketIds.has(socket.id)) {
        roomState.controllerSocketIds.delete(socket.id);
        log(
          `Controller left room ${currentRoomCode}. Remaining: ${roomState.controllerSocketIds.size}`
        );

        // Notify the app so it can remove the cursor/user if desired
        if (roomState.appSocketId) {
          io.to(roomState.appSocketId).emit("controller_disconnected", {
            controllerId: socket.id,
          });
        }

        broadcastControllerPresence(currentRoomCode);
      }
    });

    // -------------------------------------------------------------------------
    // App Registration (new room)
    // -------------------------------------------------------------------------

    socket.on("register_app_room", () => {
      let roomCode = generateRoomCode();
      while (roomStates.has(roomCode)) {
        roomCode = generateRoomCode();
      }
      currentRoomCode = roomCode;

      const newRoomState = createInitialRoomState(socket.id);
      roomStates.set(roomCode, newRoomState);

      socket.join(roomCode);
      socket.emit("your_room_id", roomCode);
      socket.emit("initial_state", newRoomState.lastKnownAppState);

      log(`App registered new room: ${roomCode}`);
    });

    // -------------------------------------------------------------------------
    // App Rejoin (inherit existing room)
    // -------------------------------------------------------------------------

    socket.on("rejoin_app_room", (roomCode) => {
      const upperRoomCode = String(roomCode || "").toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      if (!roomState) {
        socket.emit("rejoin_failed", upperRoomCode);
        return;
      }

      currentRoomCode = upperRoomCode;
      roomState.appSocketId = socket.id; // Update to the new socket ID
      socket.join(upperRoomCode);

      socket.emit("your_room_id", upperRoomCode);
      socket.emit("initial_state", roomState.lastKnownAppState);

      // Notify controllers that the app is back and may have changed.
      roomState.controllerSocketIds.forEach((sid) => {
        io.to(sid).emit("app_reconnected");
        io.to(sid).emit("controller_refresh", { roomCode: upperRoomCode });
      });

      log(`App rejoined room: ${upperRoomCode}`);
    });

    // -------------------------------------------------------------------------
    // Controller Registration
    // -------------------------------------------------------------------------

    socket.on("register_controller_room", (roomCode) => {
      const upperRoomCode = String(roomCode || "").toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      if (!roomState) {
        warn(`Controller failed to join invalid room: ${upperRoomCode}`);
        socket.emit("invalid_room", upperRoomCode);
        return;
      }

      currentRoomCode = upperRoomCode;
      roomState.controllerSocketIds.add(socket.id);
      socket.join(upperRoomCode);

      // Confirm join to controller
      socket.emit("join_success", { roomId: upperRoomCode });

      log(
        `Controller joined room ${upperRoomCode}. Total: ${roomState.controllerSocketIds.size}`
      );

      // Notify the app that a controller has joined (optional convenience event)
      if (roomState.appSocketId) {
        io.to(roomState.appSocketId).emit("controller_joined", {
          controllerId: socket.id,
        });
      }

      broadcastControllerPresence(upperRoomCode);
    });

    // -------------------------------------------------------------------------
    // App-side State Reporting (for rejoins)
    // -------------------------------------------------------------------------

    socket.on("report_app_state", (data) => {
      if (!data || !data.roomId) return;
      const upperRoomCode = String(data.roomId).toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      // Ensure the message is from the legitimate app for that room.
      if (roomState && socket.id === roomState.appSocketId) {
        roomState.lastKnownAppState = data.state || {};
      }
    });

    // -------------------------------------------------------------------------
    // Generic Event Relay from Controller to App
    // -------------------------------------------------------------------------

    socket.on("send_event_to_app", (data) => {
      if (!data || !data.roomId || !data.eventName) return;
      const upperRoomCode = String(data.roomId).toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      // Security: Ensure sender is a registered controller for this room.
      if (!roomState || !roomState.controllerSocketIds.has(socket.id)) {
        warn(
          `Unauthorized event from socket ${socket.id} for room ${upperRoomCode}`
        );
        return;
      }

      if (roomState.appSocketId) {
        io.to(roomState.appSocketId).emit("controller_event", {
          eventName: data.eventName,
          payload: data.payload || {},
          controllerId: socket.id, // ✅ identify sender for multi-user apps
        });
      }
    });

    // -------------------------------------------------------------------------
    // Generic Event Relay from App to Controllers (broadcast)
    // -------------------------------------------------------------------------

    socket.on("send_event_to_controllers", (data) => {
      if (!data || !data.roomId || !data.eventName) return;
      const upperRoomCode = String(data.roomId).toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      // Security: Ensure sender is the legitimate app for this room.
      if (!roomState || socket.id !== roomState.appSocketId) {
        warn(
          `Unauthorized app->controllers event from socket ${socket.id} for room ${upperRoomCode}`
        );
        return;
      }

      const payload = data.payload || {};
      roomState.controllerSocketIds.forEach((sid) => {
        io.to(sid).emit("app_event", {
          eventName: data.eventName,
          payload,
        });
      });
    });

    // -------------------------------------------------------------------------
    // Event Relay from App to Specific Controller (Unicast)
    // -------------------------------------------------------------------------

    socket.on("send_event_to_controller", (data) => {
      if (!data || !data.roomId || !data.eventName || !data.targetId) return;
      const upperRoomCode = String(data.roomId).toUpperCase();
      const roomState = roomStates.get(upperRoomCode);

      // Security: Ensure sender is the legitimate app for this room.
      if (!roomState || socket.id !== roomState.appSocketId) {
        warn(
          `Unauthorized app->controller event from socket ${socket.id} for room ${upperRoomCode}`
        );
        return;
      }

      // Security: Ensure target is actually in the room
      if (roomState.controllerSocketIds.has(data.targetId)) {
        io.to(data.targetId).emit("app_event", {
          eventName: data.eventName,
          payload: data.payload || {},
        });
      }
    });
  });

  // Expose state for debugging/inspection if needed.
  return {
    options,
    roomStates,
  };
}

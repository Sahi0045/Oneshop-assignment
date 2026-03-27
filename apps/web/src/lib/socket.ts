import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocketOptions {
  namespace?: string;
  token?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface SocketInstance {
  socket: Socket;
  namespace: string;
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

const DEFAULT_OPTIONS: Partial<SocketOptions> = {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

// ─── Socket registry (singleton per namespace) ────────────────────────────────

const socketRegistry = new Map<string, Socket>();

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Creates (or returns an existing) Socket.IO instance for a given namespace.
 * Sockets are cached per namespace so callers always get the same instance.
 */
export function createSocket(
  namespace: string = '/',
  token?: string,
  options: Partial<SocketOptions> = {},
): Socket {
  const ns = namespace.startsWith('/') ? namespace : `/${namespace}`;
  const cacheKey = `${ns}:${token ?? 'anon'}`;

  // Return cached socket if it already exists and is still open
  const cached = socketRegistry.get(cacheKey);
  if (cached && !cached.disconnected) {
    return cached;
  }

  // If token changed or socket was disconnected, clean up old instance
  if (cached) {
    cached.removeAllListeners();
    cached.disconnect();
    socketRegistry.delete(cacheKey);
  }

  const socket = io(`${SOCKET_URL}${ns}`, {
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    autoConnect: options.autoConnect ?? DEFAULT_OPTIONS.autoConnect,
    reconnection: true,
    reconnectionAttempts: options.reconnectionAttempts ?? DEFAULT_OPTIONS.reconnectionAttempts,
    reconnectionDelay: options.reconnectionDelay ?? DEFAULT_OPTIONS.reconnectionDelay,
    reconnectionDelayMax: 5000,
    timeout: 20_000,
    forceNew: false,
  });

  // Debug listeners (only in development)
  if (process.env.NODE_ENV === 'development') {
    socket.on('connect', () => {
      console.debug(`[Socket] Connected to ${ns} (id=${socket.id})`);
    });

    socket.on('disconnect', (reason) => {
      console.debug(`[Socket] Disconnected from ${ns}: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error on ${ns}:`, err.message);
    });

    socket.on('reconnect', (attempt: number) => {
      console.debug(`[Socket] Reconnected to ${ns} after ${attempt} attempt(s)`);
    });

    socket.on('reconnect_error', (err) => {
      console.warn(`[Socket] Reconnection error on ${ns}:`, err.message);
    });

    socket.on('reconnect_failed', () => {
      console.error(`[Socket] Reconnection failed on ${ns} — giving up`);
    });
  }

  socketRegistry.set(cacheKey, socket);
  return socket;
}

/**
 * Disconnects and removes a socket from the registry.
 */
export function destroySocket(namespace: string = '/', token?: string): void {
  const ns = namespace.startsWith('/') ? namespace : `/${namespace}`;
  const cacheKey = `${ns}:${token ?? 'anon'}`;

  const socket = socketRegistry.get(cacheKey);
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socketRegistry.delete(cacheKey);
  }
}

/**
 * Disconnects all sockets in the registry and clears it.
 */
export function destroyAllSockets(): void {
  socketRegistry.forEach((socket) => {
    socket.removeAllListeners();
    socket.disconnect();
  });
  socketRegistry.clear();
}

/**
 * Updates the auth token for an existing socket by reconnecting it.
 * Call this when the user logs in or when the access token is refreshed.
 */
export function updateSocketToken(
  namespace: string = '/',
  oldToken: string | undefined,
  newToken: string,
): Socket {
  // Destroy old socket
  destroySocket(namespace, oldToken);

  // Create fresh socket with new token and immediately connect
  const socket = createSocket(namespace, newToken, { autoConnect: false });
  socket.auth = { token: newToken };
  socket.connect();
  return socket;
}

// ─── Well-known namespace helpers ─────────────────────────────────────────────

/**
 * Returns the chat socket (namespace: /chat).
 * The socket is NOT automatically connected — call socket.connect() when ready.
 */
export function getChatSocket(token?: string): Socket {
  return createSocket('/chat', token, { autoConnect: false });
}

/**
 * Returns the notifications socket (namespace: /notifications).
 */
export function getNotificationsSocket(token?: string): Socket {
  return createSocket('/notifications', token, { autoConnect: false });
}

/**
 * Returns the default (root) socket (namespace: /).
 */
export function getRootSocket(token?: string): Socket {
  return createSocket('/', token, { autoConnect: false });
}

// ─── Higher-level helper: connect with token ─────────────────────────────────

/**
 * Connects a socket to a given namespace using a Bearer token.
 * Returns the connected socket instance.
 */
export function connectSocket(namespace: string, token: string): Socket {
  const socket = createSocket(namespace, token, { autoConnect: false });

  if (!socket.connected) {
    // Ensure auth is up-to-date before connecting
    socket.auth = { token };
    socket.connect();
  }

  return socket;
}

// ─── Event emitter helpers ────────────────────────────────────────────────────

/**
 * Emits an event and returns a Promise that resolves with the server's
 * acknowledgement, or rejects after a timeout.
 */
export function emitWithAck<TPayload = unknown, TResponse = unknown>(
  socket: Socket,
  event: string,
  payload: TPayload,
  timeoutMs: number = 5000,
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Socket event "${event}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.emit(event, payload, (response: TResponse) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/**
 * Subscribes to a socket event and returns an unsubscribe function.
 */
export function onSocketEvent<T = unknown>(
  socket: Socket,
  event: string,
  handler: (data: T) => void,
): () => void {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

/**
 * Subscribes to a socket event exactly once and returns a Promise.
 */
export function onceSocketEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs?: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handler = (data: T) => {
      if (timer) clearTimeout(timer);
      resolve(data);
    };

    socket.once(event, handler);

    if (timeoutMs) {
      timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`Timed out waiting for socket event "${event}"`));
      }, timeoutMs);
    }
  });
}

// ─── Socket status helpers ────────────────────────────────────────────────────

export function isSocketConnected(socket: Socket | null | undefined): boolean {
  return socket?.connected ?? false;
}

export function getSocketId(socket: Socket | null | undefined): string | undefined {
  return socket?.id;
}

export function getRegistrySize(): number {
  return socketRegistry.size;
}

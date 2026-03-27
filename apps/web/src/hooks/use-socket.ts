import { useEffect, useRef, useState, useCallback } from 'react';
import { type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface UseSocketOptions {
  /** Whether to automatically connect when the hook mounts. Defaults to true. */
  autoConnect?: boolean;
  /** Whether to automatically disconnect on unmount. Defaults to true. */
  autoDisconnect?: boolean;
  /** Maximum reconnection attempts before giving up. Defaults to 5. */
  reconnectionAttempts?: number;
  /** Base reconnection delay in ms. Defaults to 1000. */
  reconnectionDelay?: number;
  /** Called when the socket successfully connects. */
  onConnect?: (socketId: string) => void;
  /** Called when the socket disconnects. */
  onDisconnect?: (reason: string) => void;
  /** Called on connection errors. */
  onError?: (error: Error) => void;
  /** Called on every reconnection attempt. */
  onReconnectAttempt?: (attempt: number) => void;
}

export interface UseSocketReturn {
  socket: Socket | null;
  status: SocketStatus;
  socketId: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  emit: <T = unknown>(event: string, data?: T) => void;
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages a Socket.IO connection for a given namespace.
 *
 * - Automatically connects when an access token is available.
 * - Tears down the socket when the user logs out (token becomes null).
 * - Reconnects when the token changes (e.g., after a refresh).
 * - Provides a stable `emit` / `on` / `off` API.
 *
 * @example
 * ```tsx
 * const { socket, isConnected, emit, on } = useSocket('/chat');
 *
 * useEffect(() => {
 *   return on('new_message', (msg) => console.log(msg));
 * }, [on]);
 * ```
 */
export function useSocket(
  namespace: string = '/',
  options: UseSocketOptions = {},
): UseSocketReturn {
  const {
    autoConnect = true,
    autoDisconnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
    onConnect,
    onDisconnect,
    onError,
    onReconnectAttempt,
  } = options;

  const { accessToken } = useAuthStore();

  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [socketId, setSocketId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Track the token we last connected with to detect changes
  const lastTokenRef = useRef<string | null>(null);

  // ── Stable namespace ref (avoids effect re-runs on inline string literals) ──
  const namespaceRef = useRef<string>(namespace);
  namespaceRef.current = namespace;

  // ── Callbacks ref (stable references for event handlers) ─────────────────
  const callbacksRef = useRef({ onConnect, onDisconnect, onError, onReconnectAttempt });
  callbacksRef.current = { onConnect, onDisconnect, onError, onReconnectAttempt };

  // ─────────────────────────────────────────────────────────────────────────
  // Core connect / disconnect helpers
  // ─────────────────────────────────────────────────────────────────────────

  const destroySocket = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    s.removeAllListeners();
    if (s.connected) s.disconnect();
    socketRef.current = null;
    lastTokenRef.current = null;
    setStatus('disconnected');
    setSocketId(undefined);
  }, []);

  const createAndConnect = useCallback(
    (token: string) => {
      // Tear down any existing socket first
      destroySocket();

      setStatus('connecting');
      setError(null);

      const ns = namespaceRef.current;
      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

      // Dynamic import keeps Socket.IO out of the SSR bundle
      import('socket.io-client').then(({ io }) => {
        const nsPath = ns.startsWith('/') ? ns : `/${ns}`;

        const socket = io(`${socketUrl}${nsPath}`, {
          auth: { token },
          transports: ['websocket', 'polling'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts,
          reconnectionDelay,
          reconnectionDelayMax: 5000,
          timeout: 20_000,
          forceNew: true,
        });

        // ── Connection events ────────────────────────────────────────────

        socket.on('connect', () => {
          setStatus('connected');
          setSocketId(socket.id);
          setError(null);
          callbacksRef.current.onConnect?.(socket.id ?? '');
        });

        socket.on('disconnect', (reason: string) => {
          setStatus('disconnected');
          setSocketId(undefined);
          callbacksRef.current.onDisconnect?.(reason);
        });

        socket.on('connect_error', (err: Error) => {
          setStatus('error');
          setError(err.message);
          callbacksRef.current.onError?.(err);

          if (process.env.NODE_ENV === 'development') {
            console.warn(`[useSocket:${ns}] connect_error:`, err.message);
          }
        });

        socket.io.on('reconnect_attempt', (attempt: number) => {
          setStatus('connecting');
          callbacksRef.current.onReconnectAttempt?.(attempt);

          if (process.env.NODE_ENV === 'development') {
            console.debug(`[useSocket:${ns}] reconnect attempt #${attempt}`);
          }
        });

        socket.io.on('reconnect', () => {
          setStatus('connected');
          setSocketId(socket.id);
          setError(null);
        });

        socket.io.on('reconnect_failed', () => {
          setStatus('error');
          setError(`Failed to reconnect after ${reconnectionAttempts} attempts`);
        });

        socketRef.current = socket;

        // Actually assign here (TS isn't happy with the above pattern so let's be direct)
        socketRef.current = socket;
        lastTokenRef.current = token;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destroySocket, reconnectionAttempts, reconnectionDelay],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Effect: connect / disconnect when token changes
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoConnect) return;

    if (!accessToken) {
      // User logged out — clean up
      if (socketRef.current) {
        destroySocket();
      }
      setStatus('idle');
      return;
    }

    // Connect if:
    // • No socket exists yet, OR
    // • Token has changed since last connect
    if (!socketRef.current || lastTokenRef.current !== accessToken) {
      createAndConnect(accessToken);
    }

    return () => {
      if (autoDisconnect) {
        destroySocket();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, autoConnect, autoDisconnect]);

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /** Manually connect (or reconnect) the socket using the current access token. */
  const connect = useCallback(() => {
    if (!accessToken) {
      console.warn('[useSocket] Cannot connect: no access token available');
      return;
    }
    createAndConnect(accessToken);
  }, [accessToken, createAndConnect]);

  /** Manually disconnect the socket. */
  const disconnect = useCallback(() => {
    destroySocket();
  }, [destroySocket]);

  /**
   * Emit a socket event. Safe to call even if the socket is not yet connected
   * (the call will be silently dropped with a dev warning).
   */
  const emit = useCallback(<T = unknown>(event: string, data?: T) => {
    const s = socketRef.current;
    if (!s?.connected) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[useSocket] emit("${event}") skipped — socket not connected`,
        );
      }
      return;
    }
    if (data !== undefined) {
      s.emit(event, data);
    } else {
      s.emit(event);
    }
  }, []);

  /**
   * Subscribe to a socket event.
   * Returns an unsubscribe function for use in `useEffect` cleanup.
   *
   * @example
   * ```tsx
   * useEffect(() => {
   *   return on('new_message', handleMessage);
   * }, [on]);
   * ```
   */
  const on = useCallback(
    <T = unknown>(
      event: string,
      handler: (data: T) => void,
    ): (() => void) => {
      const s = socketRef.current;
      if (!s) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[useSocket] on("${event}") registered before socket was created`,
          );
        }
        // Return a no-op unsubscribe
        return () => {};
      }

      s.on(event, handler as (...args: unknown[]) => void);
      return () => {
        s.off(event, handler as (...args: unknown[]) => void);
      };
    },
    // Re-memoize when the socket itself changes (connect / disconnect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status],
  );

  /**
   * Remove a socket event listener (or all listeners for an event if no
   * handler is provided).
   */
  const off = useCallback(
    (event: string, handler?: (...args: unknown[]) => void) => {
      const s = socketRef.current;
      if (!s) return;

      if (handler) {
        s.off(event, handler);
      } else {
        s.off(event);
      }
    },
    [],
  );

  return {
    socket: socketRef.current,
    status,
    socketId,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}

// ─── Namespace-specific convenience hooks ─────────────────────────────────────

/**
 * Socket for the `/chat` namespace.
 */
export function useChatSocket(options?: UseSocketOptions): UseSocketReturn {
  return useSocket('/chat', options);
}

/**
 * Socket for the `/notifications` namespace.
 */
export function useNotificationsSocket(
  options?: UseSocketOptions,
): UseSocketReturn {
  return useSocket('/notifications', options);
}

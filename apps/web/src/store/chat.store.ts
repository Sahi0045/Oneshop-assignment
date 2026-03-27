import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Socket } from 'socket.io-client';
import type { Conversation, Message, TypingIndicator } from '@freelancer/shared';
import { SocketEvents } from '@freelancer/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: 'TEXT' | 'FILE' | 'IMAGE';
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }>;
}

export interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  conversationsLoading: boolean;
  conversationsError: string | null;

  // Messages keyed by conversationId
  messages: Record<string, Message[]>;
  messagesLoading: Record<string, boolean>;
  messagesError: Record<string, string | null>;

  // Typing indicators: conversationId → array of user display names
  typingUsers: Record<string, string[]>;

  // Socket
  socket: Socket | null;
  socketConnected: boolean;
  socketError: string | null;

  // Online users
  onlineUserIds: Set<string>;

  // Unread counts
  unreadCounts: Record<string, number>;
}

export interface ChatActions {
  // Conversations
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setConversationsLoading: (loading: boolean) => void;
  setConversationsError: (error: string | null) => void;

  // Messages
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  setMessagesLoading: (conversationId: string, loading: boolean) => void;
  setMessagesError: (conversationId: string, error: string | null) => void;

  // Typing
  setTyping: (conversationId: string, userId: string, userName: string, isTyping: boolean) => void;
  clearTyping: (conversationId: string) => void;

  // Unread
  setUnreadCount: (conversationId: string, count: number) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;

  // Online users
  setOnlineUsers: (userIds: string[]) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  isUserOnline: (userId: string) => boolean;

  // Socket
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
  setSocketConnected: (connected: boolean) => void;
  setSocketError: (error: string | null) => void;

  // Socket event emitters
  emitSendMessage: (payload: SendMessagePayload) => void;
  emitStartTyping: (conversationId: string) => void;
  emitStopTyping: (conversationId: string) => void;
  emitMarkRead: (conversationId: string, lastReadMessageId: string) => void;
  emitJoinConversation: (conversationId: string) => void;
  emitLeaveConversation: (conversationId: string) => void;

  // Reset
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  conversationsLoading: false,
  conversationsError: null,
  messages: {},
  messagesLoading: {},
  messagesError: {},
  typingUsers: {},
  socket: null,
  socketConnected: false,
  socketError: null,
  onlineUserIds: new Set<string>(),
  unreadCounts: {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState & ChatActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── Conversations ──────────────────────────────────────────────────────

    setConversations: (conversations) =>
      set({ conversations }),

    addConversation: (conversation) =>
      set((state) => {
        const exists = state.conversations.some((c) => c.id === conversation.id);
        if (exists) return state;
        return { conversations: [conversation, ...state.conversations] };
      }),

    updateConversation: (id, updates) =>
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, ...updates } : c,
        ),
      })),

    removeConversation: (id) =>
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
      })),

    setActiveConversation: (id) => {
      set({ activeConversationId: id });

      // Auto-clear unread count when switching to a conversation
      if (id) {
        get().clearUnread(id);

        // Join the socket room
        get().emitJoinConversation(id);
      }
    },

    setConversationsLoading: (loading) =>
      set({ conversationsLoading: loading }),

    setConversationsError: (error) =>
      set({ conversationsError: error }),

    // ── Messages ───────────────────────────────────────────────────────────

    setMessages: (conversationId, messages) =>
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: messages,
        },
      })),

    addMessage: (conversationId, message) =>
      set((state) => {
        const existing = state.messages[conversationId] ?? [];

        // Deduplicate by id
        if (existing.some((m) => m.id === message.id)) return state;

        const updated = [...existing, message];

        // Update the last message on the conversation
        const conversations = state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: message,
                lastMessageAt: message.createdAt,
              }
            : c,
        );

        // Sort conversations by last message time
        conversations.sort((a, b) => {
          const aTime = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : new Date(a.createdAt).getTime();
          const bTime = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        // Auto-increment unread if not the active conversation
        const unreadCounts = { ...state.unreadCounts };
        if (state.activeConversationId !== conversationId) {
          unreadCounts[conversationId] = (unreadCounts[conversationId] ?? 0) + 1;
        }

        return {
          messages: { ...state.messages, [conversationId]: updated },
          conversations,
          unreadCounts,
        };
      }),

    updateMessage: (conversationId, messageId, updates) =>
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] ?? []).map((m) =>
            m.id === messageId ? { ...m, ...updates } : m,
          ),
        },
      })),

    removeMessage: (conversationId, messageId) =>
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] ?? []).filter(
            (m) => m.id !== messageId,
          ),
        },
      })),

    prependMessages: (conversationId, messages) =>
      set((state) => {
        const existing = state.messages[conversationId] ?? [];
        // Deduplicate and prepend (older messages loaded via pagination)
        const existingIds = new Set(existing.map((m) => m.id));
        const newMessages = messages.filter((m) => !existingIds.has(m.id));
        return {
          messages: {
            ...state.messages,
            [conversationId]: [...newMessages, ...existing],
          },
        };
      }),

    setMessagesLoading: (conversationId, loading) =>
      set((state) => ({
        messagesLoading: { ...state.messagesLoading, [conversationId]: loading },
      })),

    setMessagesError: (conversationId, error) =>
      set((state) => ({
        messagesError: { ...state.messagesError, [conversationId]: error },
      })),

    // ── Typing ─────────────────────────────────────────────────────────────

    setTyping: (conversationId, userId, userName, isTyping) =>
      set((state) => {
        const current = state.typingUsers[conversationId] ?? [];

        const updated = isTyping
          ? current.includes(userName)
            ? current
            : [...current, userName]
          : current.filter((name) => name !== userName);

        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: updated,
          },
        };
      }),

    clearTyping: (conversationId) =>
      set((state) => ({
        typingUsers: { ...state.typingUsers, [conversationId]: [] },
      })),

    // ── Unread ─────────────────────────────────────────────────────────────

    setUnreadCount: (conversationId, count) =>
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [conversationId]: count },
      })),

    incrementUnread: (conversationId) =>
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [conversationId]: (state.unreadCounts[conversationId] ?? 0) + 1,
        },
      })),

    clearUnread: (conversationId) =>
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
      })),

    // ── Online users ───────────────────────────────────────────────────────

    setOnlineUsers: (userIds) =>
      set({ onlineUserIds: new Set(userIds) }),

    setUserOnline: (userId) =>
      set((state) => ({
        onlineUserIds: new Set([...state.onlineUserIds, userId]),
      })),

    setUserOffline: (userId) =>
      set((state) => {
        const updated = new Set(state.onlineUserIds);
        updated.delete(userId);
        return { onlineUserIds: updated };
      }),

    isUserOnline: (userId) => get().onlineUserIds.has(userId),

    // ── Socket ─────────────────────────────────────────────────────────────

    connectSocket: (token: string) => {
      // Lazily import to avoid SSR issues
      import('@/lib/socket').then(({ connectSocket }) => {
        const existingSocket = get().socket;
        if (existingSocket?.connected) return;

        const socket = connectSocket('/chat', token);

        // ── Inbound event handlers ──────────────────────────────────────

        socket.on(SocketEvents.NEW_MESSAGE, (message: Message) => {
          get().addMessage(message.conversationId, message);
        });

        socket.on(
          SocketEvents.MESSAGE_EDITED,
          (data: { messageId: string; conversationId: string; content: string; editedAt: Date }) => {
            get().updateMessage(data.conversationId, data.messageId, {
              content: data.content,
              isEdited: true,
              editedAt: data.editedAt,
            });
          },
        );

        socket.on(
          SocketEvents.MESSAGE_DELETED,
          (data: { messageId: string; conversationId: string; deletedAt: Date }) => {
            get().updateMessage(data.conversationId, data.messageId, {
              deletedAt: data.deletedAt,
              content: '[Message deleted]',
            });
          },
        );

        socket.on(SocketEvents.USER_TYPING, (indicator: TypingIndicator) => {
          const { conversationId, userId, userFirstName, userLastName } = indicator;
          get().setTyping(
            conversationId,
            userId,
            `${userFirstName} ${userLastName}`.trim(),
            true,
          );

          // Auto-clear typing indicator after 4 seconds
          setTimeout(() => {
            get().setTyping(
              conversationId,
              userId,
              `${userFirstName} ${userLastName}`.trim(),
              false,
            );
          }, 4000);
        });

        socket.on(SocketEvents.USER_STOPPED_TYPING, (indicator: TypingIndicator) => {
          const { conversationId, userId, userFirstName, userLastName } = indicator;
          get().setTyping(
            conversationId,
            userId,
            `${userFirstName} ${userLastName}`.trim(),
            false,
          );
        });

        socket.on(
          SocketEvents.USER_ONLINE,
          (data: { userId: string }) => {
            get().setUserOnline(data.userId);
          },
        );

        socket.on(
          SocketEvents.USER_OFFLINE,
          (data: { userId: string }) => {
            get().setUserOffline(data.userId);
          },
        );

        socket.on(
          SocketEvents.ONLINE_USERS,
          (data: { userIds: string[] }) => {
            get().setOnlineUsers(data.userIds);
          },
        );

        socket.on(SocketEvents.CONNECT, () => {
          set({ socketConnected: true, socketError: null });

          // Re-join active conversation room on reconnect
          const activeId = get().activeConversationId;
          if (activeId) {
            socket.emit(SocketEvents.JOIN_CONVERSATION, {
              conversationId: activeId,
            });
          }
        });

        socket.on(SocketEvents.DISCONNECT, () => {
          set({ socketConnected: false });
        });

        socket.on(SocketEvents.CONNECT_ERROR, (err: Error) => {
          set({ socketConnected: false, socketError: err.message });
        });

        set({ socket, socketConnected: socket.connected });
      });
    },

    disconnectSocket: () => {
      const { socket } = get();
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        set({ socket: null, socketConnected: false });
      }
    },

    setSocketConnected: (connected) =>
      set({ socketConnected: connected }),

    setSocketError: (error) =>
      set({ socketError: error }),

    // ── Emitters ───────────────────────────────────────────────────────────

    emitSendMessage: (payload) => {
      const { socket } = get();
      if (!socket?.connected) {
        console.warn('[ChatStore] Cannot send message: socket not connected');
        return;
      }
      socket.emit(SocketEvents.SEND_MESSAGE, payload);
    },

    emitStartTyping: (conversationId) => {
      const { socket } = get();
      if (!socket?.connected) return;
      socket.emit(SocketEvents.TYPING_START, { conversationId });
    },

    emitStopTyping: (conversationId) => {
      const { socket } = get();
      if (!socket?.connected) return;
      socket.emit(SocketEvents.TYPING_STOP, { conversationId });
    },

    emitMarkRead: (conversationId, lastReadMessageId) => {
      const { socket } = get();
      if (!socket?.connected) return;
      socket.emit(SocketEvents.MARK_READ, { conversationId, lastReadMessageId });
      get().clearUnread(conversationId);
    },

    emitJoinConversation: (conversationId) => {
      const { socket } = get();
      if (!socket?.connected) return;
      socket.emit(SocketEvents.JOIN_CONVERSATION, { conversationId });
    },

    emitLeaveConversation: (conversationId) => {
      const { socket } = get();
      if (!socket?.connected) return;
      socket.emit(SocketEvents.LEAVE_CONVERSATION, { conversationId });
    },

    // ── Reset ──────────────────────────────────────────────────────────────

    reset: () => {
      const { socket } = get();
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      set({ ...initialState, onlineUserIds: new Set<string>() });
    },
  })),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectConversations = (state: ChatState & ChatActions) =>
  state.conversations;

export const selectActiveConversationId = (state: ChatState & ChatActions) =>
  state.activeConversationId;

export const selectActiveConversation = (state: ChatState & ChatActions) =>
  state.conversations.find((c) => c.id === state.activeConversationId) ?? null;

export const selectMessages =
  (conversationId: string) =>
  (state: ChatState & ChatActions): Message[] =>
    state.messages[conversationId] ?? [];

export const selectTypingUsers =
  (conversationId: string) =>
  (state: ChatState & ChatActions): string[] =>
    state.typingUsers[conversationId] ?? [];

export const selectUnreadCount =
  (conversationId: string) =>
  (state: ChatState & ChatActions): number =>
    state.unreadCounts[conversationId] ?? 0;

export const selectTotalUnreadCount = (state: ChatState & ChatActions): number =>
  Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);

export const selectSocketConnected = (state: ChatState & ChatActions): boolean =>
  state.socketConnected;

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
}

export enum ConversationType {
  DIRECT = 'DIRECT',
  PROJECT = 'PROJECT',
  SUPPORT = 'SUPPORT',
}

export enum SocketEvents {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',

  // Authentication
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  UNAUTHORIZED = 'unauthorized',

  // Conversations
  JOIN_CONVERSATION = 'join_conversation',
  LEAVE_CONVERSATION = 'leave_conversation',
  CONVERSATION_JOINED = 'conversation_joined',
  CONVERSATION_LEFT = 'conversation_left',

  // Messages — Client emits
  SEND_MESSAGE = 'send_message',
  EDIT_MESSAGE = 'edit_message',
  DELETE_MESSAGE = 'delete_message',
  MARK_READ = 'mark_read',

  // Messages — Server emits
  NEW_MESSAGE = 'new_message',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGES_READ = 'messages_read',

  // Typing indicators
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_TYPING = 'user_typing',
  USER_STOPPED_TYPING = 'user_stopped_typing',

  // Presence
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  GET_ONLINE_USERS = 'get_online_users',
  ONLINE_USERS = 'online_users',

  // Notifications
  NOTIFICATION = 'notification',
  UNREAD_COUNT = 'unread_count',

  // Errors
  ERROR = 'error',
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  attachments: MessageAttachment[];
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  sender?: MessageSender;
  readBy?: MessageReadReceipt[];
}

export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface MessageSender {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isVerified: boolean;
}

export interface MessageReadReceipt {
  userId: string;
  readAt: Date;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  projectId?: string;
  contractId?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ConversationParticipant {
  conversationId: string;
  userId: string;
  joinedAt: Date;
  lastReadAt?: Date;
  isArchived: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    isVerified: boolean;
    lastSeen?: Date;
    isOnline?: boolean;
  };
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
}

export interface EditMessagePayload {
  messageId: string;
  content: string;
}

export interface DeleteMessagePayload {
  messageId: string;
}

export interface MarkReadPayload {
  conversationId: string;
  lastReadMessageId: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface CreateConversationInput {
  type: ConversationType;
  participantIds: string[];
  projectId?: string;
  contractId?: string;
  initialMessage?: string;
}

export interface ConversationFilter {
  type?: ConversationType;
  projectId?: string;
  contractId?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface MessageFilter {
  conversationId: string;
  before?: Date;
  after?: Date;
  type?: MessageType;
  page?: number;
  limit?: number;
}

export interface SocketAuthPayload {
  token: string;
}

export interface SocketErrorPayload {
  event: string;
  message: string;
  code?: string;
}

export interface OnlineUsersPayload {
  userIds: string[];
}

export enum NotificationType {
  BID_RECEIVED = 'BID_RECEIVED',
  BID_ACCEPTED = 'BID_ACCEPTED',
  BID_REJECTED = 'BID_REJECTED',
  BID_WITHDRAWN = 'BID_WITHDRAWN',
  CONTRACT_STARTED = 'CONTRACT_STARTED',
  CONTRACT_COMPLETED = 'CONTRACT_COMPLETED',
  CONTRACT_CANCELLED = 'CONTRACT_CANCELLED',
  CONTRACT_PAUSED = 'CONTRACT_PAUSED',
  MILESTONE_CREATED = 'MILESTONE_CREATED',
  MILESTONE_SUBMITTED = 'MILESTONE_SUBMITTED',
  MILESTONE_APPROVED = 'MILESTONE_APPROVED',
  MILESTONE_REVISION_REQUESTED = 'MILESTONE_REVISION_REQUESTED',
  MILESTONE_DISPUTED = 'MILESTONE_DISPUTED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_SENT = 'PAYMENT_SENT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
  ESCROW_FUNDED = 'ESCROW_FUNDED',
  ESCROW_RELEASED = 'ESCROW_RELEASED',
  DISPUTE_OPENED = 'DISPUTE_OPENED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  DISPUTE_ESCALATED = 'DISPUTE_ESCALATED',
  DISPUTE_CLOSED = 'DISPUTE_CLOSED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  REVIEW_REMINDER = 'REVIEW_REMINDER',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  ACCOUNT_VERIFIED = 'ACCOUNT_VERIFIED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
  PROJECT_EXPIRING = 'PROJECT_EXPIRING',
  PROJECT_CLOSED = 'PROJECT_CLOSED',
  SYSTEM = 'SYSTEM',
}

export type NotificationChannel = 'in_app' | 'email' | 'push';

export interface NotificationData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationWithUser extends Notification {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

export interface NotificationFilter {
  userId?: string;
  type?: NotificationType;
  isRead?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  limit?: number;
}

export interface NotificationSummary {
  totalCount: number;
  unreadCount: number;
  byType: Partial<Record<NotificationType, number>>;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

export interface BulkCreateNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

export interface MarkNotificationsReadInput {
  userId: string;
  notificationIds?: string[];
  markAll?: boolean;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  disabledTypes: NotificationType[];
  emailDigestFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: NotificationData;
  clickAction?: string;
}

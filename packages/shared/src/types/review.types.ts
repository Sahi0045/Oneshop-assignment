import { ReviewType } from "./user.types";

export { ReviewType };

export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  ESCALATED = "ESCALATED",
}

export enum DisputeReason {
  WORK_NOT_DELIVERED = "WORK_NOT_DELIVERED",
  WORK_NOT_AS_DESCRIBED = "WORK_NOT_AS_DESCRIBED",
  PAYMENT_NOT_RELEASED = "PAYMENT_NOT_RELEASED",
  SCOPE_CREEP = "SCOPE_CREEP",
  COMMUNICATION_BREAKDOWN = "COMMUNICATION_BREAKDOWN",
  DEADLINE_MISSED = "DEADLINE_MISSED",
  QUALITY_ISSUES = "QUALITY_ISSUES",
  FRAUD = "FRAUD",
  OTHER = "OTHER",
}

export interface DisputeAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface Dispute {
  id: string;
  contractId: string;
  milestoneId?: string;
  initiatorId: string;
  respondentId: string;
  assignedAdminId?: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  adminNote?: string;
  attachments: DisputeAttachment[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface DisputeWithDetails extends Dispute {
  initiator: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    email: string;
    role: string;
  };
  respondent: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    email: string;
    role: string;
  };
  assignedAdmin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  contract: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    status: string;
  };
  milestone?: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    status: string;
  };
}

export interface DisputeFilter {
  contractId?: string;
  initiatorId?: string;
  respondentId?: string;
  assignedAdminId?: string;
  status?: DisputeStatus;
  reason?: DisputeReason;
  page?: number;
  limit?: number;
  sort?: DisputeSortField;
  order?: "asc" | "desc";
}

export enum DisputeSortField {
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
  RESOLVED_AT = "resolvedAt",
  STATUS = "status",
}

export interface ReviewRatings {
  communicationRating: number;
  qualityRating: number;
  timelinessRating: number;
}

export interface ReviewWithDetails {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  communicationRating: number;
  qualityRating: number;
  timelinessRating: number;
  type: ReviewType;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
    isVerified: boolean;
  };
  reviewee: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
    isVerified: boolean;
  };
  contract: {
    id: string;
    title: string;
    amount: number;
    currency: string;
  };
}

export interface ReviewFilter {
  revieweeId?: string;
  reviewerId?: string;
  contractId?: string;
  type?: ReviewType;
  minRating?: number;
  maxRating?: number;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sort?: ReviewSortField;
  order?: "asc" | "desc";
}

export enum ReviewSortField {
  CREATED_AT = "createdAt",
  RATING = "rating",
}

export interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
  averageCommunicationRating: number;
  averageQualityRating: number;
  averageTimelinessRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

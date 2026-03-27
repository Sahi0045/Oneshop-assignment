export enum ProjectStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  DISPUTED = "DISPUTED",
}

export enum ProjectType {
  FIXED_PRICE = "FIXED_PRICE",
  HOURLY = "HOURLY",
  CONTEST = "CONTEST",
}

export enum ProjectVisibility {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
  INVITE_ONLY = "INVITE_ONLY",
}

export enum BidStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  createdAt: Date;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  order: number;
}

export interface Project {
  id: string;
  clientId: string;
  categoryId?: string;
  category?: Category;
  title: string;
  description: string;
  type: ProjectType;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  deadline?: Date;
  skills: string[];
  status: ProjectStatus;
  visibility: ProjectVisibility;
  attachments: string[];
  viewCount: number;
  bidCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    country?: string;
    isVerified: boolean;
    totalSpent?: number;
    completionRate?: number;
  };
  bids?: Bid[];
  milestones?: ProjectMilestone[];
  averageBidAmount?: number;
  lowestBidAmount?: number;
  highestBidAmount?: number;
}

export interface Bid {
  id: string;
  projectId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  deliveryDays: number;
  coverLetter: string;
  attachments: string[];
  status: BidStatus;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidWithDetails extends Bid {
  freelancer: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    country?: string;
    isVerified: boolean;
    hourlyRate?: number;
    totalEarned?: number;
    completionRate?: number;
    averageRating?: number;
    totalReviews?: number;
    skills?: Array<{
      skillId: string;
      level: string;
      skill: { id: string; name: string; category: string };
    }>;
  };
  project?: Project;
}

export interface ProjectFilter {
  search?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  skills?: string[];
  categoryId?: string;
  country?: string;
  visibility?: ProjectVisibility;
  clientId?: string;
  page?: number;
  limit?: number;
  sort?: ProjectSortField;
  order?: "asc" | "desc";
}

export enum ProjectSortField {
  CREATED_AT = "createdAt",
  BUDGET_MIN = "budgetMin",
  BUDGET_MAX = "budgetMax",
  DEADLINE = "deadline",
  BID_COUNT = "bidCount",
  VIEW_COUNT = "viewCount",
}

export interface BidFilter {
  projectId?: string;
  freelancerId?: string;
  status?: BidStatus;
  page?: number;
  limit?: number;
  sort?: BidSortField;
  order?: "asc" | "desc";
}

export enum BidSortField {
  CREATED_AT = "createdAt",
  AMOUNT = "amount",
  DELIVERY_DAYS = "deliveryDays",
}

export interface BidAnalytics {
  totalBids: number;
  averageAmount: number;
  lowestAmount: number;
  highestAmount: number;
  averageDeliveryDays: number;
  bidsByStatus: Record<BidStatus, number>;
  recentBids: BidWithDetails[];
}

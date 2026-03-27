export enum ContractStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  PAUSED = "PAUSED",
  DISPUTED = "DISPUTED",
}

export enum MilestoneStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REVISION_REQUESTED = "REVISION_REQUESTED",
  DISPUTED = "DISPUTED",
}

export enum TransactionType {
  PAYMENT = "PAYMENT",
  REFUND = "REFUND",
  WITHDRAWAL = "WITHDRAWAL",
  DEPOSIT = "DEPOSIT",
  ESCROW_HOLD = "ESCROW_HOLD",
  ESCROW_RELEASE = "ESCROW_RELEASE",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export interface Contract {
  id: string;
  projectId: string;
  bidId: string;
  clientId: string;
  freelancerId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: ContractStatus;
  startDate: Date;
  endDate?: Date;
  terms: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractWithDetails extends Contract {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    country?: string;
    isVerified: boolean;
    totalSpent?: number;
  };
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
  };
  milestones: Milestone[];
  transactions: Transaction[];
  totalPaid: number;
  totalPending: number;
  completedMilestones: number;
  totalMilestones: number;
}

export interface Milestone {
  id: string;
  contractId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  order: number;
  status: MilestoneStatus;
  submissionNote?: string;
  submissionAttachments: string[];
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneWithContract extends Milestone {
  contract: Pick<
    Contract,
    "id" | "title" | "clientId" | "freelancerId" | "currency"
  >;
}

export interface Transaction {
  id: string;
  contractId?: string;
  milestoneId?: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  externalId?: string;
  gateway?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  feeAmount: number;
  netAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionWithDetails extends Transaction {
  payer: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
  };
  payee: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: string;
  };
  contract?: Pick<Contract, "id" | "title" | "projectId">;
  milestone?: Pick<Milestone, "id" | "title" | "order">;
}

export interface ContractFilter {
  clientId?: string;
  freelancerId?: string;
  status?: ContractStatus;
  projectId?: string;
  page?: number;
  limit?: number;
  sort?: ContractSortField;
  order?: "asc" | "desc";
}

export enum ContractSortField {
  CREATED_AT = "createdAt",
  START_DATE = "startDate",
  END_DATE = "endDate",
  AMOUNT = "amount",
}

export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  cancelledContracts: number;
  disputedContracts: number;
  totalEarned: number;
  totalSpent: number;
  averageContractValue: number;
  completionRate: number;
}

export interface EscrowSummary {
  contractId: string;
  totalAmount: number;
  heldInEscrow: number;
  released: number;
  refunded: number;
  currency: string;
  milestoneBreakdown: Array<{
    milestoneId: string;
    title: string;
    amount: number;
    status: MilestoneStatus;
    escrowStatus: "held" | "released" | "refunded" | "pending";
  }>;
}

export enum UserRole {
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}

export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
}

export enum ReviewType {
  CLIENT_TO_FREELANCER = 'CLIENT_TO_FREELANCER',
  FREELANCER_TO_CLIENT = 'FREELANCER_TO_CLIENT',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  hourlyRate?: number;
  currency: string;
  country?: string;
  city?: string;
  timezone?: string;
  isVerified: boolean;
  isActive: boolean;
  lastSeen?: Date;
  totalEarned?: number;
  totalSpent?: number;
  completionRate?: number;
  profileCompleteness: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  createdAt: Date;
}

export interface UserSkill {
  userId: string;
  skillId: string;
  level: SkillLevel;
  skill: Skill;
}

export interface Review {
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
}

export interface UserProfile extends User {
  skills: UserSkill[];
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  badges: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: UserRole;
  isVerified: boolean;
  country?: string;
  city?: string;
  hourlyRate?: number;
  currency: string;
  completionRate?: number;
  profileCompleteness: number;
  createdAt: Date;
}

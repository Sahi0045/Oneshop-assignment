import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isValid, parseISO } from 'date-fns';

// ─── Tailwind class merge ─────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Currency formatting ──────────────────────────────────────────────────────

export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options: Intl.NumberFormatOptions = {},
): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

export function formatCurrencyCompact(amount: number, currency: string = 'USD'): string {
  if (amount >= 1_000_000) {
    return formatCurrency(amount / 1_000_000, currency) + 'M';
  }
  if (amount >= 1_000) {
    return formatCurrency(amount / 1_000, currency) + 'K';
  }
  return formatCurrency(amount, currency);
}

export function formatBudgetRange(min: number, max: number, currency: string = 'USD'): string {
  if (min === max) return formatCurrency(min, currency);
  return `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function toDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);
  const parsed = parseISO(date);
  return isValid(parsed) ? parsed : new Date(date);
}

export function formatDate(
  date: Date | string | number,
  pattern: string = 'MMM d, yyyy',
): string {
  try {
    return format(toDate(date), pattern);
  } catch {
    return 'Invalid date';
  }
}

export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, 'MMM d, yyyy · h:mm a');
}

export function formatShortDate(date: Date | string | number): string {
  return formatDate(date, 'MMM d');
}

export function formatRelativeTime(date: Date | string | number): string {
  try {
    const d = toDate(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function formatTimeAgo(date: Date | string | number): string {
  try {
    return formatDistanceToNow(toDate(date), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function isDatePast(date: Date | string | number): boolean {
  return toDate(date).getTime() < Date.now();
}

export function getDaysUntil(date: Date | string | number): number {
  const diff = toDate(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatDeadline(date: Date | string | number): string {
  const days = getDaysUntil(date);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatDate(date)}`;
}

// ─── String utilities ─────────────────────────────────────────────────────────

export function truncateText(text: string, maxLength: number, ellipsis: string = '…'): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + ellipsis;
}

export function truncateMiddle(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const halfLen = Math.floor((maxLength - 3) / 2);
  return `${text.slice(0, halfLen)}...${text.slice(-halfLen)}`;
}

export function capitalise(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(capitalise)
    .join(' ');
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function pluralise(count: number, singular: string, plural?: string): string {
  const pluralForm = plural ?? `${singular}s`;
  return count === 1 ? `1 ${singular}` : `${count.toLocaleString()} ${pluralForm}`;
}

// ─── User / Avatar utilities ──────────────────────────────────────────────────

export function getInitials(firstName: string, lastName: string): string {
  const f = (firstName ?? '').trim().charAt(0).toUpperCase();
  const l = (lastName ?? '').trim().charAt(0).toUpperCase();
  if (!f && !l) return '?';
  return `${f}${l}`;
}

export function getFullName(firstName: string, lastName: string): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

export function getAvatarFallbackUrl(
  firstName: string,
  lastName: string,
  size: number = 128,
): string {
  const name = encodeURIComponent(`${firstName} ${lastName}`.trim());
  return `https://ui-avatars.com/api/?name=${name}&size=${size}&background=random&color=fff&bold=true`;
}

// ─── Status color helpers ─────────────────────────────────────────────────────

const STATUS_COLOR_MAP: Record<string, string> = {
  // Project statuses
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
  DISPUTED: 'badge-disputed',
  DRAFT: 'badge-draft',
  // Bid statuses
  PENDING: 'badge-pending',
  ACCEPTED: 'badge-accepted',
  REJECTED: 'badge-rejected',
  WITHDRAWN: 'badge-withdrawn',
  // Contract statuses
  ACTIVE: 'badge-in-progress',
  PAUSED: 'badge-draft',
  // Milestone statuses
  SUBMITTED: 'badge-pending',
  APPROVED: 'badge-accepted',
  REVISION_REQUESTED: 'badge-disputed',
};

export function getStatusColor(status: string): string {
  return STATUS_COLOR_MAP[status?.toUpperCase()] ?? 'badge-draft';
}

const STATUS_TAILWIND_MAP: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ACTIVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DISPUTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  WITHDRAWN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  PAUSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  SUBMITTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  VERIFIED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  UNVERIFIED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export function getStatusTailwindClass(status: string): string {
  return STATUS_TAILWIND_MAP[status?.toUpperCase()] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
}

export function getStatusDotColor(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'bg-green-500',
    IN_PROGRESS: 'bg-blue-500',
    ACTIVE: 'bg-blue-500',
    COMPLETED: 'bg-purple-500',
    CANCELLED: 'bg-red-500',
    DISPUTED: 'bg-orange-500',
    DRAFT: 'bg-gray-400',
    PENDING: 'bg-yellow-500',
    ACCEPTED: 'bg-green-500',
    REJECTED: 'bg-red-500',
    WITHDRAWN: 'bg-gray-400',
  };
  return map[status?.toUpperCase()] ?? 'bg-gray-400';
}

// ─── Number utilities ─────────────────────────────────────────────────────────

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(n);
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatPercentage(value: number, total: number, decimals: number = 0): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(decimals)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── File utilities ───────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

export function getFileIconType(filename: string): 'image' | 'pdf' | 'doc' | 'zip' | 'code' | 'file' {
  const ext = getFileExtension(filename);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'doc';
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'zip';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'html', 'css', 'json'].includes(ext)) return 'code';
  return 'file';
}

export function isImageFile(filename: string): boolean {
  return getFileIconType(filename) === 'image';
}

// ─── URL utilities ────────────────────────────────────────────────────────────

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (filtered.length === 0) return '';
  return '?' + filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export function parseQueryString(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// ─── Array utilities ──────────────────────────────────────────────────────────

export function groupBy<T>(
  array: T[],
  key: (item: T) => string,
): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((acc, item) => {
    const group = key(item);
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

export function unique<T>(array: T[], key?: (item: T) => unknown): T[] {
  if (!key) return [...new Set(array)];
  const seen = new Set();
  return array.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ─── Password strength ────────────────────────────────────────────────────────

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  score: number; // 0–4
  strength: PasswordStrength;
  label: string;
  color: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  const map: Record<number, { strength: PasswordStrength; label: string; color: string }> = {
    0: { strength: 'weak', label: 'Very weak', color: 'bg-destructive' },
    1: { strength: 'weak', label: 'Weak', color: 'bg-destructive' },
    2: { strength: 'fair', label: 'Fair', color: 'bg-orange-400' },
    3: { strength: 'good', label: 'Good', color: 'bg-yellow-400' },
    4: { strength: 'strong', label: 'Strong', color: 'bg-green-500' },
    5: { strength: 'strong', label: 'Very strong', color: 'bg-green-600' },
  };

  const { strength, label, color } = map[score] ?? map[0];

  return { score, strength, label, color, checks };
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function noop(): void {}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(k => delete result[k]);
  return result as Omit<T, K>;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(k => { result[k] = obj[k]; });
  return result;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

export function generateId(prefix?: string): string {
  const id = Math.random().toString(36).slice(2, 11);
  return prefix ? `${prefix}_${id}` : id;
}

export function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined') return Promise.resolve();
  return navigator.clipboard.writeText(text);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return 'An unexpected error occurred';
}

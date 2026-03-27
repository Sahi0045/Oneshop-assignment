'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

// ─── Avatar Root ──────────────────────────────────────────────────────────────

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

// ─── AvatarImage ──────────────────────────────────────────────────────────────

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

// ─── AvatarFallback ───────────────────────────────────────────────────────────

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      'text-sm font-semibold text-muted-foreground select-none',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// ─── AvatarGroup ─────────────────────────────────────────────────────────────

interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarGroupSizeMap: Record<string, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

function AvatarGroup({
  children,
  max,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const totalCount = childArray.length;
  const visibleChildren = max ? childArray.slice(0, max) : childArray;
  const overflowCount = max ? Math.max(0, totalCount - max) : 0;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visibleChildren.map((child, index) => (
        <div
          key={index}
          className={cn(
            'ring-2 ring-background rounded-full',
            avatarGroupSizeMap[size],
          )}
          style={{ zIndex: visibleChildren.length - index }}
        >
          {React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                className: cn(
                  avatarGroupSizeMap[size],
                  (child as React.ReactElement<{ className?: string }>).props.className,
                ),
              })
            : child}
        </div>
      ))}

      {overflowCount > 0 && (
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full',
            'bg-muted text-muted-foreground font-semibold',
            'ring-2 ring-background',
            avatarGroupSizeMap[size],
          )}
          style={{ zIndex: 0 }}
          aria-label={`+${overflowCount} more`}
          title={`+${overflowCount} more`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

// ─── UserAvatar convenience component ────────────────────────────────────────

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-20 w-20 text-xl',
};

const onlineIndicatorSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5 bottom-0 right-0',
  sm: 'h-2 w-2 bottom-0 right-0',
  md: 'h-2.5 w-2.5 bottom-0 right-0',
  lg: 'h-3 w-3 bottom-0.5 right-0.5',
  xl: 'h-3.5 w-3.5 bottom-0.5 right-0.5',
  '2xl': 'h-4 w-4 bottom-1 right-1',
};

export interface UserAvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  alt?: string;
  size?: AvatarSize;
  className?: string;
  /** When true, show a green online presence dot. */
  isOnline?: boolean;
  /** When true, show a blue verified checkmark badge. */
  isVerified?: boolean;
  /** Fallback color override (Tailwind background class, e.g. "bg-blue-500"). */
  fallbackColor?: string;
}

function UserAvatar({
  src,
  firstName = '',
  lastName = '',
  alt,
  size = 'md',
  className,
  isOnline,
  isVerified,
  fallbackColor,
}: UserAvatarProps) {
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

  const altText =
    alt ?? (`${firstName} ${lastName}`.trim() || 'User avatar');

  return (
    <div className="relative inline-flex shrink-0">
      <Avatar className={cn(avatarSizeClasses[size], className)}>
        {src && (
          <AvatarImage
            src={src}
            alt={altText}
            className="object-cover"
          />
        )}
        <AvatarFallback
          className={cn(
            'font-semibold',
            fallbackColor ?? 'bg-primary/10 text-primary',
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Online indicator */}
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute block rounded-full ring-2 ring-background',
            onlineIndicatorSizeClasses[size],
            isOnline ? 'bg-green-500' : 'bg-gray-400',
          )}
          aria-label={isOnline ? 'Online' : 'Offline'}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}

      {/* Verified checkmark */}
      {isVerified && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full',
            'bg-blue-500 text-white ring-2 ring-background',
            size === 'xs' || size === 'sm'
              ? 'h-3 w-3 -bottom-0.5 -right-0.5'
              : size === 'md'
              ? 'h-4 w-4 -bottom-0.5 -right-0.5'
              : 'h-5 w-5 bottom-0 right-0',
          )}
          aria-label="Verified"
          title="Verified"
        >
          <svg
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-2/3 w-2/3"
            aria-hidden="true"
          >
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, UserAvatar };

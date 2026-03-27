'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ─── Root ─────────────────────────────────────────────────────────────────────

const Tabs = TabsPrimitive.Root;

// ─── TabsList variants ────────────────────────────────────────────────────────

const tabsListVariants = cva(
  'inline-flex items-center justify-center rounded-md text-muted-foreground',
  {
    variants: {
      variant: {
        default:
          'h-10 bg-muted p-1',
        underline:
          'h-auto rounded-none border-b border-border bg-transparent p-0 w-full',
        pills:
          'h-auto bg-transparent p-0 gap-1',
        outline:
          'h-10 border border-border bg-transparent p-1 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

// ─── TabsTrigger variants ─────────────────────────────────────────────────────

const tabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium',
    'ring-offset-background transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'rounded-sm px-3 py-1.5',
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        ],
        underline: [
          'rounded-none border-b-2 border-transparent px-4 pb-3 pt-2',
          'data-[state=active]:border-primary data-[state=active]:text-foreground',
          'hover:text-foreground',
        ],
        pills: [
          'rounded-full px-4 py-1.5',
          'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
          'hover:bg-muted hover:text-foreground',
          'data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground',
        ],
        outline: [
          'rounded-md px-3 py-1.5 border border-transparent',
          'data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
          'hover:bg-muted/50 hover:text-foreground',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

// ─── Context ──────────────────────────────────────────────────────────────────

type TabsVariant = VariantProps<typeof tabsListVariants>['variant'];

interface TabsContextValue {
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextValue>({
  variant: 'default',
});

function useTabsContext() {
  return React.useContext(TabsContext);
}

// ─── TabsList ─────────────────────────────────────────────────────────────────

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = 'default', children, ...props }, ref) => (
  <TabsContext.Provider value={{ variant }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

// ─── TabsTrigger ──────────────────────────────────────────────────────────────

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode;
  /** Badge content (e.g. count) rendered after the label. */
  badge?: React.ReactNode;
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, icon, badge, children, ...props }, ref) => {
  const { variant } = useTabsContext();

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    >
      {icon && (
        <span
          className="mr-1.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {children}
      {badge !== undefined && badge !== null && (
        <span
          className={cn(
            'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center',
            'rounded-full px-1 text-[10px] font-semibold tabular-nums',
            'bg-muted text-muted-foreground',
            'group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary',
          )}
        >
          {badge}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// ─── TabsContent ──────────────────────────────────────────────────────────────

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Animate in on mount
      'data-[state=active]:animate-in data-[state=active]:fade-in-0',
      'data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0',
      'duration-150',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

// ─── Exports ──────────────────────────────────────────────────────────────────

export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsListProps, TabsTriggerProps, TabsVariant };

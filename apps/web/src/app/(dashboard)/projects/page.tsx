'use client';

import React, { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useProjects } from '@/hooks/use-projects';
import { ProjectCard } from '@/components/projects/project-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ProjectType, ProjectStatus, ProjectSortField } from '@freelancer/shared';
import type { ProjectFilter } from '@freelancer/shared';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;

const PROJECT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: ProjectType.FIXED_PRICE, label: 'Fixed Price' },
  { value: ProjectType.HOURLY, label: 'Hourly' },
  { value: ProjectType.CONTEST, label: 'Contest' },
];

const SORT_OPTIONS = [
  { value: `${ProjectSortField.CREATED_AT}:desc`, label: 'Newest First' },
  { value: `${ProjectSortField.CREATED_AT}:asc`, label: 'Oldest First' },
  { value: `${ProjectSortField.BUDGET_MAX}:desc`, label: 'Budget: High to Low' },
  { value: `${ProjectSortField.BUDGET_MAX}:asc`, label: 'Budget: Low to High' },
  { value: `${ProjectSortField.BID_COUNT}:desc`, label: 'Most Bids' },
  { value: `${ProjectSortField.DEADLINE}:asc`, label: 'Deadline: Soonest' },
];

const BUDGET_RANGES = [
  { label: 'Any Budget', min: undefined, max: undefined },
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 – $1,000', min: 500, max: 1000 },
  { label: '$1,000 – $5,000', min: 1000, max: 5000 },
  { label: '$5,000 – $10,000', min: 5000, max: 10000 },
  { label: '$10,000+', min: 10000, max: undefined },
];

const POPULAR_SKILLS = [
  'React', 'Node.js', 'Python', 'TypeScript', 'UI/UX Design',
  'Next.js', 'AWS', 'PostgreSQL', 'GraphQL', 'Flutter',
];

// ─── Filter state ─────────────────────────────────────────────────────────────

interface FilterState {
  search: string;
  type: string;
  budgetRange: number;
  skills: string[];
  sort: string;
  page: number;
}

const defaultFilters: FilterState = {
  search: '',
  type: 'all',
  budgetRange: 0,
  skills: [],
  sort: `${ProjectSortField.CREATED_AT}:desc`,
  page: 1,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildQueryFilters(filters: FilterState): Partial<ProjectFilter> {
  const [sort, order] = filters.sort.split(':') as [ProjectSortField, 'asc' | 'desc'];
  const budgetRange = BUDGET_RANGES[filters.budgetRange];

  return {
    search: filters.search || undefined,
    type: filters.type !== 'all' ? (filters.type as ProjectType) : undefined,
    status: ProjectStatus.OPEN,
    budgetMin: budgetRange.min,
    budgetMax: budgetRange.max,
    skills: filters.skills.length > 0 ? filters.skills : undefined,
    sort,
    order,
    page: filters.page,
    limit: ITEMS_PER_PAGE,
  };
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────

function ProjectsGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build page numbers to show
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-4"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm select-none">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={page === p ? 'default' : 'outline'}
            size="icon-sm"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={page === p ? 'page' : undefined}
            className="min-w-8"
          >
            {p}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isClient = user?.role === 'CLIENT';
  const isFreelancer = user?.role === 'FREELANCER';

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Build API query
  const queryFilters = buildQueryFilters(filters);

  // For clients, override to show their own projects
  const finalFilters: Partial<ProjectFilter> = isClient
    ? { ...queryFilters, clientId: 'me', status: undefined }
    : queryFilters;

  const { data, isLoading, isError, error } = useProjects(finalFilters);

  const projects = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  // ── Filter updaters ──────────────────────────────────────────────────────

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    [],
  );

  const toggleSkill = useCallback((skill: string) => {
    setFilters((prev) => {
      const has = prev.skills.includes(skill);
      return {
        ...prev,
        skills: has ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
        page: 1,
      };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters =
    filters.search ||
    filters.type !== 'all' ||
    filters.budgetRange !== 0 ||
    filters.skills.length > 0;

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.budgetRange !== 0 ? 1 : 0) +
    filters.skills.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isClient ? 'My Projects' : 'Browse Projects'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isClient
              ? 'Manage your posted projects and review bids.'
              : 'Find your next project from thousands of opportunities.'}
            {pagination && (
              <span className="ml-1 font-medium text-foreground">
                ({pagination.total.toLocaleString()} results)
              </span>
            )}
          </p>
        </div>

        {isClient && (
          <Link href="/projects/new" className="shrink-0">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Post a Project
            </Button>
          </Link>
        )}
      </div>

      {/* ── Search + Sort toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={isClient ? 'Search your projects…' : 'Search projects by title or skills…'}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search projects"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <Select
            value={filters.sort}
            onValueChange={(v) => updateFilter('sort', v)}
          >
            <SelectTrigger className="w-[180px] sm:w-[200px]" aria-label="Sort projects">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter toggle (mobile / compact) */}
          <Button
            variant="outline"
            className="gap-1.5 relative"
            onClick={() => setIsFilterOpen((p) => !p)}
            aria-expanded={isFilterOpen}
            aria-controls="filter-panel"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Active filter pills ────────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          <span className="text-xs font-medium text-muted-foreground">Active filters:</span>

          {filters.search && (
            <Badge variant="outline" className="gap-1.5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => updateFilter('search', '')}>
              Search: &ldquo;{filters.search}&rdquo;
              <X className="h-3 w-3" />
            </Badge>
          )}

          {filters.type !== 'all' && (
            <Badge variant="outline" className="gap-1.5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => updateFilter('type', 'all')}>
              {PROJECT_TYPES.find((t) => t.value === filters.type)?.label}
              <X className="h-3 w-3" />
            </Badge>
          )}

          {filters.budgetRange !== 0 && (
            <Badge variant="outline" className="gap-1.5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => updateFilter('budgetRange', 0)}>
              {BUDGET_RANGES[filters.budgetRange].label}
              <X className="h-3 w-3" />
            </Badge>
          )}

          {filters.skills.map((skill) => (
            <Badge
              key={skill}
              variant="skill"
              className="gap-1.5 cursor-pointer hover:bg-destructive/10 transition-colors"
              onClick={() => toggleSkill(skill)}
            >
              {skill}
              <X className="h-3 w-3" />
            </Badge>
          ))}

          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-destructive hover:underline underline-offset-4 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Main content: Filters panel + Grid ────────────────────────────── */}
      <div className="flex gap-6" id="filter-panel">
        {/* ── Filter sidebar ─────────────────────────────────────────────── */}
        <aside
          className={cn(
            'shrink-0 space-y-5',
            'lg:block lg:w-64',
            isFilterOpen ? 'block w-full sm:w-72' : 'hidden',
          )}
          aria-label="Filter options"
        >
          <Card>
            <CardContent className="p-4 space-y-5">
              {/* Project Type */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Project Type</h3>
                <div className="space-y-1.5">
                  {PROJECT_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                    >
                      <input
                        type="radio"
                        name="project-type"
                        value={type.value}
                        checked={filters.type === type.value}
                        onChange={() => updateFilter('type', type.value)}
                        className="accent-primary h-4 w-4"
                      />
                      <span className="text-sm text-foreground">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Budget Range */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Budget Range</h3>
                <div className="space-y-1.5">
                  {BUDGET_RANGES.map((range, index) => (
                    <label
                      key={range.label}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                    >
                      <input
                        type="radio"
                        name="budget-range"
                        checked={filters.budgetRange === index}
                        onChange={() => updateFilter('budgetRange', index)}
                        className="accent-primary h-4 w-4"
                      />
                      <span className="text-sm text-foreground">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Skills */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SKILLS.map((skill) => {
                    const isSelected = filters.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                          'border transition-all duration-150 cursor-pointer',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                        aria-pressed={isSelected}
                      >
                        {skill}
                        {isSelected && <X className="ml-1 h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={clearAllFilters}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear All Filters
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ── Projects Grid ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Loading state */}
          {isLoading && <ProjectsGridSkeleton />}

          {/* Error state */}
          {isError && (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <X className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Failed to load projects</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {(error as Error)?.message ?? 'Something went wrong. Please try again.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !isError && projects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Search className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {isClient ? 'No projects yet' : 'No projects found'}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    {isClient
                      ? "You haven't posted any projects yet. Post your first project to start receiving bids."
                      : hasActiveFilters
                      ? 'No projects match your current filters. Try adjusting your search criteria.'
                      : 'There are no open projects available right now. Check back soon!'}
                  </p>
                </div>
                {isClient ? (
                  <Link href="/projects/new">
                    <Button className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      Post Your First Project
                    </Button>
                  </Link>
                ) : hasActiveFilters ? (
                  <Button variant="outline" onClick={clearAllFilters} className="gap-1.5">
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Projects grid */}
          {!isLoading && !isError && projects.length > 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isFreelancer={isFreelancer}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
                      Showing{' '}
                      <span className="font-medium text-foreground">
                        {(filters.page - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(filters.page * ITEMS_PER_PAGE, pagination.total)}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium text-foreground">
                        {pagination.total.toLocaleString()}
                      </span>{' '}
                      projects
                    </p>
                    <Pagination
                      page={filters.page}
                      totalPages={totalPages}
                      onPageChange={(page) => updateFilter('page', page)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

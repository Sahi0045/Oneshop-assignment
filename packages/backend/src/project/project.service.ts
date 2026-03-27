import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FilterProjectDto } from './dto/filter-project.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum ProjectStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectType {
  FIXED_PRICE = 'FIXED_PRICE',
  HOURLY = 'HOURLY',
}

export enum UserRole {
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Kafka topics (kept as constants so they are easy to move to a shared enum)
// ---------------------------------------------------------------------------
const KAFKA_TOPICS = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
} as const;

const VIEW_COUNT_KEY = (projectId: string) => `project:views:${projectId}`;

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // findAll — paginated project list with filters
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(
    filters: FilterProjectDto,
    _requestingUserId?: string,
  ): Promise<PaginatedResult<any>> {
    const {
      search,
      type,
      status,
      minBudget,
      maxBudget,
      skills,
      categoryId,
      clientId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip      = (safePage - 1) * safeLimit;

    // ── Build the Prisma `where` clause ──────────────────────────────────────
    const where: any = {};

    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    } else {
      // Default to showing OPEN projects when no status filter is given
      where.status = ProjectStatus.OPEN;
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
      where.budgetMin = {};
      if (minBudget !== undefined) where.budgetMin.gte = minBudget;
      if (maxBudget !== undefined) where.budgetMax = { lte: maxBudget };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Handle clientId filter - resolve "me" to the requesting user's ID
    if (clientId) {
      if (clientId === 'me') {
        if (!_requestingUserId) {
          throw new Error('Cannot filter by clientId=me without authentication');
        }
        where.clientId = _requestingUserId;
      } else {
        where.clientId = clientId;
      }
    }

    if (skills && skills.length > 0) {
      const skillList = Array.isArray(skills)
        ? skills
        : (skills as string).split(',').map((s: string) => s.trim());

      // skills is a String[] in the schema, use hasSome for array overlap
      where.skills = {
        hasSome: skillList,
      };
    }

    // ── Build the `orderBy` clause ────────────────────────────────────────────
    const allowedSortFields: Record<string, string> = {
      createdAt: 'createdAt',
      budget:    'budgetMin',
      bidCount:  'bidCount',
      viewCount: 'viewCount',
    };

    const sortField = allowedSortFields[sortBy] ?? 'createdAt';
    const orderBy: any = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };

    // ── Execute queries in parallel ───────────────────────────────────────────
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              rating: true,
            },
          },
          category: {
            select: { id: true, name: true },
          },
          _count: {
            select: { bids: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    // Merge in cached view counts from Redis
    const enrichedItems = await Promise.all(
      items.map(async (project) => {
        const cachedViews = await this.redisService
          .get(VIEW_COUNT_KEY(project.id))
          .catch(() => null);

        return {
          ...project,
          viewCount: cachedViews ? parseInt(cachedViews, 10) : (project as any).viewCount ?? 0,
        };
      }),
    );

    return {
      items: enrichedItems,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // findOne — full project detail
  // ─────────────────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<any> {
    const project = await this.prisma.project.findFirst({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            rating: true,
            totalReviews: true,
            createdAt: true,
            _count: {
              select: { projectsAsClient: true },
            },
          },
        },
        category: {
          select: { id: true, name: true },
        },
        bids: {
          where: { status: { not: 'WITHDRAWN' } },
          orderBy: { createdAt: 'desc' },
          include: {
            freelancer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                hourlyRate: true,
                rating: true,
                totalReviews: true,
                bio: true,
              },
            },
          },
        },
        contract: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" was not found.`);
    }

    // Merge cached view count
    const cachedViews = await this.redisService
      .get(VIEW_COUNT_KEY(id))
      .catch(() => null);

    return {
      ...project,
      viewCount: cachedViews
        ? parseInt(cachedViews, 10)
        : (project as any).viewCount ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────────

  async create(clientId: string, dto: CreateProjectDto): Promise<any> {
    const { skills, categoryId, ...projectData } = dto as any;

    // Validate category exists (if provided)
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID "${categoryId}" was not found.`);
      }
    }

    // skills is a String[] in the schema, just pass it directly
    const project = await this.prisma.project.create({
      data: {
        ...projectData,
        clientId,
        status: ProjectStatus.OPEN,
        bidCount: 0,
        viewCount: 0,
        ...(categoryId ? { categoryId } : {}),
        ...(skills && Array.isArray(skills) && skills.length > 0 ? { skills } : { skills: [] }),
      },
      include: {
        category: { select: { id: true, name: true } },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Emit Kafka event (non-blocking; failures are logged, not thrown)
    this.emitKafkaEvent(KAFKA_TOPICS.PROJECT_CREATED, {
      projectId:   project.id,
      clientId,
      title:       project.title,
      type:        project.type,
      budgetMin:   (project as any).budgetMin,
      budgetMax:   (project as any).budgetMax,
      skills:      skills ?? [],
      occurredAt:  new Date().toISOString(),
    }).catch((err) =>
      this.logger.error('Kafka emit PROJECT_CREATED failed', err),
    );

    this.logger.log(`Project created: ${project.id} by client: ${clientId}`);
    return project;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    userId: string,
    dto: UpdateProjectDto,
    userRole: string,
  ): Promise<any> {
    const project = await this.findExistingProject(id);

    // Only the owner or ADMIN may update
    if (project.clientId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not authorized to update this project.');
    }

    // Cannot edit a project once work has started
    if (
      project.status === ProjectStatus.IN_PROGRESS ||
      project.status === ProjectStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Cannot edit a project that is IN_PROGRESS or COMPLETED.',
      );
    }

    const { skills, categoryId, ...updateData } = dto as any;

    // Build update data
    const dataToUpdate: any = {
      ...updateData,
      updatedAt: new Date(),
    };

    if (categoryId) {
      dataToUpdate.categoryId = categoryId;
    }

    // skills is a String[] in the schema, just set it directly
    if (skills && Array.isArray(skills)) {
      dataToUpdate.skills = skills;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: dataToUpdate,
      include: {
        category: { select: { id: true, name: true } },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Emit Kafka event
    this.emitKafkaEvent(KAFKA_TOPICS.PROJECT_UPDATED, {
      projectId:  id,
      updatedBy:  userId,
      changes:    Object.keys(updateData),
      occurredAt: new Date().toISOString(),
    }).catch((err) =>
      this.logger.error('Kafka emit PROJECT_UPDATED failed', err),
    );

    this.logger.log(`Project updated: ${id} by user: ${userId}`);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // delete (soft delete)
  // ─────────────────────────────────────────────────────────────────────────────

  async delete(id: string, userId: string, userRole: string): Promise<void> {
    const project = await this.findExistingProject(id);

    // Only the owner or ADMIN may delete
    if (project.clientId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You are not authorized to delete this project.');
    }

    // Cannot delete once work is in progress or completed
    if (
      project.status === ProjectStatus.IN_PROGRESS ||
      project.status === ProjectStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Cannot delete a project that is IN_PROGRESS or COMPLETED.',
      );
    }

    // Soft delete — keep the row but mark it as deleted
    await this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.CANCELLED,
        deletedAt: new Date(),
      },
    });

    // Remove cached view count
    await this.redisService.del(VIEW_COUNT_KEY(id)).catch(() => null);

    // Emit Kafka event
    this.emitKafkaEvent(KAFKA_TOPICS.PROJECT_DELETED, {
      projectId:  id,
      deletedBy:  userId,
      occurredAt: new Date().toISOString(),
    }).catch((err) =>
      this.logger.error('Kafka emit PROJECT_DELETED failed', err),
    );

    this.logger.log(`Project soft-deleted: ${id} by user: ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getBidsForProject — restricted to project owner
  // ─────────────────────────────────────────────────────────────────────────────

  async getBidsForProject(
    projectId: string,
    clientId: string,
    statusFilter?: string,
  ): Promise<any[]> {
    const project = await this.findExistingProject(projectId);

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Only the project owner can view bids.');
    }

    const where: any = { projectId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const bids = await this.prisma.bid.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            hourlyRate: true,
            rating: true,
            totalReviews: true,
            _count: {
              select: { contractsAsFreelancer: true },
            },
          },
        },
      },
    });

    return bids;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // incrementViewCount — atomic increment via Redis INCR
  // ─────────────────────────────────────────────────────────────────────────────

  async incrementViewCount(projectId: string): Promise<void> {
    try {
      const key = VIEW_COUNT_KEY(projectId);

      // Atomically increment the counter in Redis
      const newCount = await this.redisService.incr(key);

      // Every 50 views, flush the count to the database (write-behind pattern)
      if (newCount % 50 === 0) {
        await this.prisma.project
          .update({
            where: { id: projectId },
            data:  { viewCount: newCount },
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to flush view count to DB for project ${projectId}: ${err.message}`,
            ),
          );
      }
    } catch (err) {
      // View count is non-critical — log but do not propagate
      this.logger.warn(
        `View count increment skipped for project ${projectId}: ${err.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves a project that has not been soft-deleted, throwing 404 if absent.
   */
  private async findExistingProject(id: string): Promise<any> {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" was not found.`);
    }

    return project;
  }

  /**
   * Emits a Kafka event.
   *
   * In the current monolith setup this is a no-op stub that logs the event.
   * When splitting into microservices, replace the body with the real
   * @nestjs/microservices ClientKafka.emit() call.
   */
  private async emitKafkaEvent(topic: string, payload: Record<string, any>): Promise<void> {
    this.logger.debug(
      `[Kafka] → topic: "${topic}"  payload: ${JSON.stringify(payload)}`,
    );

    // TODO: replace with real Kafka client when splitting into microservices
    // await this.kafkaClient.emit(topic, {
    //   key:   payload.projectId,
    //   value: JSON.stringify(payload),
    // }).toPromise();
  }
}

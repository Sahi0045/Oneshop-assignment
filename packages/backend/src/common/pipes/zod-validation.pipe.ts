import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ZodSchema, ZodError, z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a ZodError into an array of human-readable error strings.
 *
 * Each item in the array describes a single validation failure and includes
 * the dot-notation field path so the client can map it to a specific input.
 *
 * Examples:
 *   "email: Invalid email"
 *   "password: String must contain at least 8 character(s)"
 *   "milestones[0].amount: Number must be greater than 0"
 */
function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path
      .map((segment, index) =>
        typeof segment === 'number'
          ? `[${segment}]`
          : index === 0
          ? segment
          : `.${segment}`,
      )
      .join('');

    const prefix = path ? `${path}: ` : '';
    return `${prefix}${issue.message}`;
  });
}

// ---------------------------------------------------------------------------
// ZodValidationPipe
// ---------------------------------------------------------------------------

/**
 * ZodValidationPipe
 *
 * A custom NestJS pipe that validates (and optionally transforms) the incoming
 * value against a provided Zod schema.
 *
 * Unlike the built-in `ValidationPipe` (which relies on `class-validator` +
 * `class-transformer`), this pipe accepts any Zod schema, giving you the full
 * power of Zod's type inference, transforms, refinements, and `.superRefine()`
 * cross-field validations.
 *
 * Usage patterns
 * ──────────────
 *
 * 1. **Inline on a route parameter:**
 *    ```typescript
 *    import { z } from 'zod';
 *    import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
 *
 *    const CreateProjectSchema = z.object({
 *      title:     z.string().min(10).max(150),
 *      budgetMin: z.number().positive(),
 *      budgetMax: z.number().positive(),
 *    }).refine((d) => d.budgetMax >= d.budgetMin, {
 *      message: 'budgetMax must be >= budgetMin',
 *      path:    ['budgetMax'],
 *    });
 *
 *    @Post()
 *    create(
 *      @Body(new ZodValidationPipe(CreateProjectSchema)) dto: z.infer<typeof CreateProjectSchema>,
 *    ) { ... }
 *    ```
 *
 * 2. **As a controller-level pipe:**
 *    ```typescript
 *    @UsePipes(new ZodValidationPipe(MySchema))
 *    @Post()
 *    create(@Body() dto: MyDto) { ... }
 *    ```
 *
 * 3. **As a provider (for dependency injection):**
 *    ```typescript
 *    @Injectable()
 *    export class CreateProjectPipe extends ZodValidationPipe {
 *      constructor() { super(CreateProjectSchema); }
 *    }
 *    ```
 *
 * Behaviour
 * ─────────
 * - On **success** the parsed (and transformed) value is returned.
 *   Zod transforms (`.transform()`, `.default()`, `.coerce`) are applied.
 * - On **failure** a `BadRequestException` is thrown with a structured body:
 *   ```json
 *   {
 *     "statusCode": 400,
 *     "message":    "Validation failed",
 *     "errors": [
 *       "title: String must contain at least 10 character(s)",
 *       "budgetMax: budgetMax must be >= budgetMin"
 *     ]
 *   }
 *   ```
 *
 * When to use ZodValidationPipe vs ValidationPipe
 * ─────────────────────────────────────────────────
 * | Feature                       | ValidationPipe       | ZodValidationPipe    |
 * |-------------------------------|----------------------|----------------------|
 * | Decorator syntax              | ✅ @IsEmail() etc.   | ❌                   |
 * | Zod schemas                   | ❌                   | ✅                   |
 * | Cross-field validation        | Awkward              | ✅ .superRefine()    |
 * | Runtime type inference        | Partial (decorators) | ✅ z.infer<>         |
 * | Swagger integration           | ✅ auto via plugin   | Manual               |
 * | Transform / coerce            | class-transformer    | ✅ built-in to Zod   |
 *
 * Use `ValidationPipe` + DTO classes for most endpoints (better Swagger support).
 * Use `ZodValidationPipe` for complex schemas with cross-field rules, dynamic
 * shapes, or when you prefer Zod's fluent API over class decorators.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private readonly schema: ZodSchema) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // transform
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validates and transforms the incoming `value` against the Zod schema
   * provided at construction time.
   *
   * @param value     The raw value to validate (request body, query param, etc.)
   * @param metadata  NestJS argument metadata (type: 'body' | 'query' | 'param' | …)
   * @returns         The parsed (and transformed) value on success.
   * @throws          BadRequestException on validation failure.
   */
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Skip validation for undefined values on non-body parameters
    // (e.g. optional query params that were not provided).
    if (value === undefined && metadata.type !== 'body') {
      return value;
    }

    // Parse the value using the Zod schema.
    // `safeParse` never throws — it returns a discriminated union instead.
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    // ── Format and throw validation errors ────────────────────────────────────
    const errors = formatZodErrors(result.error);

    this.logger.debug(
      `Zod validation failed for ${metadata.type}` +
        (metadata.data ? ` "${metadata.data}"` : '') +
        `: ${errors.join('; ')}`,
    );

    throw new BadRequestException({
      statusCode: 400,
      message:    'Validation failed',
      errors,
    });
  }
}

// ---------------------------------------------------------------------------
// Factory helper — for concise inline usage
// ---------------------------------------------------------------------------

/**
 * zodPipe(schema)
 *
 * A shorthand factory that creates a `ZodValidationPipe` instance from a
 * Zod schema.  Equivalent to `new ZodValidationPipe(schema)` but slightly
 * more readable in parameter decorators:
 *
 * ```typescript
 * @Post()
 * create(@Body(zodPipe(CreateSchema)) dto: CreateDto) { ... }
 * ```
 *
 * @param schema  Any Zod schema (`z.object(...)`, `z.string()`, etc.)
 */
export function zodPipe(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

// ---------------------------------------------------------------------------
// Re-export Zod for convenience so consumers only need one import
// ---------------------------------------------------------------------------

export { z, ZodSchema, ZodError };

import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

/**
 * Allowed status transitions a client can explicitly request when updating
 * a project (e.g. cancelling an OPEN project before any bid is awarded).
 *
 * Full status transitions (OPEN → IN_PROGRESS, IN_PROGRESS → COMPLETED) are
 * handled automatically by the bid-award flow in BidService and are not
 * exposed here to prevent clients from bypassing business rules.
 */
export enum AllowedProjectStatusUpdate {
  OPEN      = 'OPEN',
  CANCELLED = 'CANCELLED',
}

/**
 * UpdateProjectDto
 *
 * All fields from CreateProjectDto become optional via PartialType so that
 * clients can send only the fields they want to change (PATCH semantics).
 *
 * Additionally, a `status` field is exposed to allow the project owner to
 * cancel an OPEN project without having to delete it.
 *
 * Fields that must NOT be changed after creation (e.g. `type`) are still
 * technically optional here — enforcement of immutability is the
 * responsibility of ProjectService.update().
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  /**
   * Optional status override.
   *
   * Only OPEN → CANCELLED is permitted via this endpoint.
   * The OPEN → IN_PROGRESS and IN_PROGRESS → COMPLETED transitions are
   * handled automatically by the bid-award and milestone-approval flows.
   */
  @ApiPropertyOptional({
    description:
      'Explicitly set the project status. ' +
      'Only **CANCELLED** is accepted here — all other transitions are ' +
      'triggered automatically by the platform (e.g. awarding a bid moves ' +
      'the project to IN_PROGRESS). ' +
      'Setting status to OPEN re-opens a previously cancelled project ' +
      '(admin only).',
    enum: AllowedProjectStatusUpdate,
    example: AllowedProjectStatusUpdate.CANCELLED,
  })
  @IsOptional()
  @IsEnum(AllowedProjectStatusUpdate, {
    message: `Status must be one of: ${Object.values(AllowedProjectStatusUpdate).join(', ')}.`,
  })
  status?: AllowedProjectStatusUpdate;
}

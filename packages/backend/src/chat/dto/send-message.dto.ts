import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  IsPositive,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

/**
 * MessageType
 *
 * Discriminates the kind of content carried by a Message record.
 *
 *   TEXT   — plain text content (default)
 *   IMAGE  — an image attachment (fileUrl points to an image resource)
 *   FILE   — any non-image file attachment (PDF, ZIP, DOCX, etc.)
 *   SYSTEM — platform-generated event message (e.g. "Contract started",
 *            "Milestone approved") — these are created server-side and
 *            cannot be sent by end-users via this DTO.
 */
export enum MessageType {
  TEXT   = 'TEXT',
  IMAGE  = 'IMAGE',
  FILE   = 'FILE',
  SYSTEM = 'SYSTEM',
}

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

/**
 * SendMessageDto
 *
 * Payload used when sending a message in a conversation.
 *
 * This DTO is shared between:
 *   1. The REST endpoint  `POST /chat/conversations/:id/messages`
 *   2. The Socket.IO      `send-message` event handler in ChatGateway
 *
 * Message types and required fields
 * ──────────────────────────────────
 * | type   | content         | fileUrl  | fileName | fileSize |
 * |--------|-----------------|----------|----------|----------|
 * | TEXT   | required        | —        | —        | —        |
 * | IMAGE  | optional caption| required | optional | optional |
 * | FILE   | optional caption| required | required | optional |
 * | SYSTEM | (server-set)    | —        | —        | —        |
 *
 * Thread / quote replies
 * ──────────────────────
 * Set `replyToId` to the UUID of the message being replied to.
 * The gateway / service layer validates that the referenced message
 * exists in the same conversation before persisting the reply.
 *
 * Optimistic UI support
 * ─────────────────────
 * The optional `tempId` field allows the frontend to track optimistic
 * messages while waiting for server confirmation.  The server echoes it
 * back in the `message:sent` delivery-receipt event so the client can
 * replace the pending placeholder with the confirmed record.
 */
export class SendMessageDto {
  // ─── Content ─────────────────────────────────────────────────────────────────

  @ApiProperty({
    description:
      'Message text content.\n\n' +
      'Required for **TEXT** messages.\n' +
      'Optional caption for **IMAGE** and **FILE** messages — pass an empty ' +
      'string `""` when no caption is needed.\n\n' +
      'Must not exceed 10 000 characters. Whitespace is trimmed server-side.',
    example:
      'Hi! I just finished reviewing your project brief. ' +
      'I have some questions about the API integration — are you free for a quick call?',
    maxLength: 10000,
  })
  @IsString({ message: 'content must be a string.' })
  @IsNotEmpty({ message: 'Message content must not be empty.' })
  @MaxLength(10_000, { message: 'Message content must not exceed 10 000 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content: string;

  // ─── Type ────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Message type discriminator. Defaults to `TEXT`.\n\n' +
      '- **`TEXT`**   — plain text, no attachment.\n' +
      '- **`IMAGE`**  — image attachment; `fileUrl` is required.\n' +
      '- **`FILE`**   — non-image attachment; `fileUrl` and `fileName` are required.\n' +
      '- **`SYSTEM`** — reserved for platform-generated messages; ' +
      'sending this type via the API is not permitted and will be overridden.',
    enum: MessageType,
    example: MessageType.TEXT,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType, {
    message: `type must be one of: ${Object.values(MessageType).join(', ')}.`,
  })
  type?: MessageType = MessageType.TEXT;

  // ─── File URL ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Publicly accessible S3 / CDN URL of the attached file or image.\n\n' +
      'Required when `type` is `IMAGE` or `FILE`.\n\n' +
      'Files must be uploaded first via the `/uploads` endpoint which returns ' +
      'a pre-signed S3 URL. Paste the resulting object URL here.',
    example:
      'https://s3.amazonaws.com/freelancer-platform-uploads/chat/attachments/project-brief.pdf',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString({ message: 'fileUrl must be a string.' })
  @IsNotEmpty({ message: 'fileUrl must not be an empty string.' })
  @MaxLength(2048, { message: 'fileUrl must not exceed 2 048 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fileUrl?: string;

  // ─── File Name ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Original filename of the attached file (for display purposes in the UI).\n\n' +
      'Recommended when `type` is `FILE`; optional but encouraged for `IMAGE`.\n\n' +
      'This value is stored as-is and shown to the recipient — use the original ' +
      'filename rather than the S3 object key.',
    example: 'project-requirements-v2.pdf',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'fileName must be a string.' })
  @IsNotEmpty({ message: 'fileName must not be an empty string.' })
  @MaxLength(255, { message: 'fileName must not exceed 255 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fileName?: string;

  // ─── File Size ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Size of the attached file in bytes.\n\n' +
      'Optional but recommended — the UI uses it to display a human-readable ' +
      'file size label (e.g. "2.4 MB") without having to fetch the file.',
    example: 2_457_600,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fileSize must be a whole number of bytes.' })
  @Min(1, { message: 'fileSize must be at least 1 byte.' })
  fileSize?: number;

  // ─── MIME Type ────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'MIME type of the attached file (e.g. `image/png`, `application/pdf`).\n\n' +
      'Optional — used by the UI to render inline previews for known types ' +
      'and to show an appropriate file-type icon for others.',
    example: 'application/pdf',
    maxLength: 127,
  })
  @IsOptional()
  @IsString({ message: 'mimeType must be a string.' })
  @MaxLength(127, { message: 'mimeType must not exceed 127 characters.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  mimeType?: string;

  // ─── Reply To ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'UUID of the message this message is replying to (thread / quote reply).\n\n' +
      'The referenced message must exist within the same conversation. ' +
      'The service layer validates this constraint and throws 404 if the ' +
      'referenced message is not found or belongs to a different conversation.\n\n' +
      'The recipient\'s UI typically renders the quoted content above the reply.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'replyToId must be a valid UUID v4.' })
  replyToId?: string;

  // ─── Temp ID (optimistic UI) ──────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Client-generated temporary ID used for optimistic UI rendering.\n\n' +
      'When the frontend sends a message via WebSocket it can optimistically ' +
      'render it with a local `tempId` before the server confirms.  ' +
      'The server echoes this value back in the `message:sent` delivery-receipt ' +
      'event so the client can replace the pending placeholder with the ' +
      'confirmed server record.\n\n' +
      'This field is ignored when using the REST fallback endpoint.',
    example: 'temp-msg-1736932800000-abc123',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'tempId must be a string.' })
  @MaxLength(100, { message: 'tempId must not exceed 100 characters.' })
  tempId?: string;
}

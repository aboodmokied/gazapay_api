import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS WRAPPER
// Shape produced by TransformInterceptor for every successful response:
//   { statusCode: number, data: T }
// ─────────────────────────────────────────────────────────────────────────────

export class ApiSuccessResponseDto {
  @ApiProperty({
    description: 'HTTP status code of the response',
    example: 200,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Response payload — varies per endpoint',
    example: {},
  })
  data: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR WRAPPER
// Shape produced by AllExceptionsFilter for every error response:
//   { statusCode, timestamp, path, message }
// ─────────────────────────────────────────────────────────────────────────────

export class ApiErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'ISO-8601 timestamp of when the error occurred',
    example: '2026-02-27T00:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that triggered the error',
    example: '/auth/login',
  })
  path: string;

  @ApiProperty({
    description:
      'Error message — a string for most errors, or an array for validation errors',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Error description or type',
    example: 'Bad Request',
  })
  error: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC ERROR SCHEMAS (400 / 401 / 403 / 404 / 409 / 500)
// ─────────────────────────────────────────────────────────────────────────────

export class BadRequestErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  declare statusCode: number;

  @ApiProperty({
    description: 'Validation error details',
    example:  ['field should not be empty', 'password min length is 6'],
  })
  declare message: string[];

  @ApiProperty({ example: 'Bad Request' })
  declare error: string;
}

export class UnauthorizedErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 401 })
  declare statusCode: number;

  @ApiProperty({ example: 'Invalid credentials' })
  declare message: string;

  @ApiProperty({ example: 'Unauthorized' })
  declare error: string;
}

export class ForbiddenErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({ example: 'Forbidden resource' })
  declare message: string;

  @ApiProperty({ example: 'Forbidden' })
  declare error: string;
}

export class NotFoundErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 404 })
  declare statusCode: number;

  @ApiProperty({ example: 'Resource not found' })
  declare message: string;

  @ApiProperty({ example: 'Not Found' })
  declare error: string;
}

export class ConflictErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 409 })
  declare statusCode: number;

  @ApiProperty({ example: 'Resource already exists' })
  declare message: string;

  @ApiProperty({ example: 'Conflict' })
  declare error: string;
}

export class InternalServerErrorDto extends ApiErrorResponseDto {
  @ApiProperty({ example: 500 })
  declare statusCode: number;

  @ApiProperty({ example: 'Internal server error' })
  declare message: string;

  @ApiProperty({ example: 'Internal Server Error' })
  declare error: string;
}

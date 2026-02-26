import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { BadRequestErrorDto, ConflictErrorDto, UnauthorizedErrorDto } from 'src/common/dto/api-response.dto';

// ─── Inline response schemas ──────────────────────────────────────────────────

class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5...' })
  access_token: string;
}

class RegisterResponseDto {
  @ApiProperty({ example: 'cuid_abc123' })
  id: string;
  @ApiProperty({ example: '0599123456' })
  phone: string;
  @ApiProperty({ example: 'John Doe', required: false })
  name?: string;
  @ApiProperty({ example: '2026-02-26T21:00:00.000Z' })
  createdAt: Date;
  @ApiProperty({ example: '2026-02-26T21:00:00.000Z' })
  updatedAt: Date;
}

// class UnauthorizedResponseDto {
//   @ApiProperty({ example: 401 })
//   statusCode: number;
//   @ApiProperty({ example: 'Invalid credentials' })
//   message: string;
//   @ApiProperty({ example: 'Unauthorized' })
//   error: string;
// }

// class BadRequestResponseDto {
//   @ApiProperty({ example: 400 })
//   statusCode: number;
//   @ApiProperty({ example: ['phone should not be empty'], type: [String] })
//   message: string[];
//   @ApiProperty({ example: 'Bad Request' })
//   error: string;
// }

// class ConflictResponseDto {
//   @ApiProperty({ example: 409 })
//   statusCode: number;
//   @ApiProperty({ example: 'Phone number already registered' })
//   message: string;
//   @ApiProperty({ example: 'Conflict' })
//   error: string;
// }

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /auth/login
   * Authenticated via LocalAuthGuard → LocalStrategy (phone + password).
   * On success, Passport attaches the validated user to req.user.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({
    summary: 'Login with phone & password',
    description:
      'Validates credentials via the local Passport strategy. ' +
      'Returns a signed JWT access token on success.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful — returns a JWT access token.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials (wrong phone or password).',
    type: UnauthorizedErrorDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or malformed body fields.',
    type: BadRequestErrorDto,
  })
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  /**
   * POST /auth/register
   * Creates a new user account. Phone must be unique.
   */
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with the provided phone and password. ' +
      'The phone number must be unique across the system.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully — returns the created user (password excluded).',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing fields or password too short (min 6 chars).',
    type: BadRequestErrorDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — a user with this phone number already exists.',
    type: ConflictErrorDto,
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }
}

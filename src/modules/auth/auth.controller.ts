import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Res,
  Req,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiProperty,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  BadRequestErrorDto,
  ConflictErrorDto,
  UnauthorizedErrorDto,
} from '../../common/dto/api-response.dto';
import { Request as HttpRequest, Response } from 'express';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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

class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;
}

class VerifyCodeResponseDto extends MessageResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5...' })
  token: string;
}

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with phone & password',
    description:
      'Validates credentials via the local Passport strategy. ' +
      'Returns a signed JWT access token on success.',
  })
  @ApiBody({ type: LoginDto })
  @ApiSuccessResponse(LoginResponseDto)
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account with the provided phone and password. ' +
      'The phone number must be unique across the system.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiSuccessResponse(RegisterResponseDto, { status: 201 })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — missing fields or password too short (min 6 chars).',
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

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiSuccessResponse(MessageResponseDto)
  @ApiResponse({
    status: 400,
    description: 'Validation error or user not found.',
    type: BadRequestErrorDto,
  })
  async resetPassword(
    @Res() res: Response,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    const { message } = await this.authService.resetPassword(resetPasswordDto);
    res.status(HttpStatus.OK).send({ message });
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify reset code and get temporary token' })
  @ApiBody({ type: VerifyCodeDto })
  @ApiSuccessResponse(VerifyCodeResponseDto)
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired code.',
    type: UnauthorizedErrorDto,
  })
  async verifyCode(@Res() res: Response, @Body() verifyCodeDto: VerifyCodeDto) {
    const { message, token } = await this.authService.verifyResetCode(
      verifyCodeDto.phone,
      verifyCodeDto.code,
    );
    res.status(HttpStatus.OK).send({ message, token });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password using reset token' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiSuccessResponse(MessageResponseDto)
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid reset token.',
    type: UnauthorizedErrorDto,
  })
  async changePassword(
    @Res() res: Response,
    @Req() req: HttpRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const bearerToken = req.headers.authorization;
    const token = bearerToken?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Missing reset token');
    }
    const { message } = await this.authService.changePassword(
      token,
      changePasswordDto,
    );
    res.status(HttpStatus.OK).send({ message });
  }
}

import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';
import { UnauthorizedErrorDto } from '../../common/dto/api-response.dto';
import { CreateUserDto } from './dto/create-user.dto'; // Need a DTO for profile if not defined, using CreateUserDto for now or a generic User object if available

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the currently authenticated user.',
  })
  @ApiSuccessResponse(CreateUserDto) // Assuming CreateUserDto for schema, should ideally be a ProfileDto or UserDto
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid JWT token.',
    type: UnauthorizedErrorDto,
  })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: ExpressRequest) {
    return req.user;
  }
}

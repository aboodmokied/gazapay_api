import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { RegisterDeviceResponseDto } from './dto/register-device-response.dto';

@ApiTags('Devices')
@Controller('devices')
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new offline device (server-side key generation)',
    description: 'Generates Ed25519 signing keys and an AES-256-GCM symmetric key for the device.',
  })
  @ApiSuccessResponse(RegisterDeviceResponseDto, { status: 201 })
  @ApiConflictResponse({ description: 'Device ID is already registered' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async register(@Body() registerDto: RegisterDeviceDto, @Request() req: any) {
    const userId = req.user.id;
    return await this.devicesService.registerDevice(userId, registerDto);
  }
}

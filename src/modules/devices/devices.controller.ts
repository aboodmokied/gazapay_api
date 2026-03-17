import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';


@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDeviceDto) {
    const device = await this.devicesService.registerDevice(registerDto);
    return {
      message: 'Device registered successfully',
      deviceId: device.id,
    };
  }
}

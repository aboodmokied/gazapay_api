import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(dto: RegisterDeviceDto) {
    const { userId, deviceId, publicKey } = dto;

    // Verify if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if device ID is already registered to prevent duplicates
    const existingDevice = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (existingDevice) {
      throw new ConflictException('Device ID is already registered');
    }

    // Register the new device
    const newDevice = await this.prisma.device.create({
      data: {
        id: deviceId,
        userId: userId,
        publicKey: publicKey,
      },
    });

    return newDevice;
  }
}

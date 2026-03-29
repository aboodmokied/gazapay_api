import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import * as crypto from 'crypto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const { deviceId } = dto;

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

    // ─── Key Generation ──────────────────────────────────────────────────────
    
    // 1. Generate Ed25519 Signing Keys
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    // 2. Generate AES-256-GCM Symmetric Key
    const aesKey = crypto.randomBytes(32).toString('base64');

    // ─── DB Persistence ───────────────────────────────────────────────────────

    const newDevice = await this.prisma.device.create({
      data: {
        id: deviceId,
        userId: userId,
        publicKey: publicKeyPem,
        aesKey: aesKey,
      },
    });

    return {
      message: 'Device registered successfully',
      deviceId: newDevice.id,
      publicKeyPem: publicKeyPem,
      privateKeyPem: privateKeyPem,
      aesKeyBase64: aesKey,
    };
  }
}

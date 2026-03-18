import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'user-123', description: 'User ID associating with the device' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'device-abc', description: 'Unique device identifier' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'base64-ed25519-public-key', description: 'Ed25519 public key' })
  @IsString()
  @IsNotEmpty()
  publicKey: string;
}

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'device-abc', description: 'Unique device identifier' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

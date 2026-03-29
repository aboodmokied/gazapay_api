import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class SimulateEncryptionDto {
  @ApiProperty({
    example: 'device-abc',
    description: 'The unique identifier for the device being simulated.',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({
    example: 'fkz3F6NUONT8bMRbwfDXM9JU1b+OKi0wp14gQiBRdaE=',
    description:
      'Optional base64-encoded 32-byte AES-256 key. If omitted, a fresh random key will be generated.',
  })
  @IsOptional()
  @IsString()
  aesKeyBase64?: string;

  @ApiPropertyOptional({
    description:
      'Optional base64-encoded Ed25519 private key (PKCS8 PEM format encoded as base64). If omitted, a fresh key pair will be generated.',
    example: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUlDb01rbUZOdHVhL2hGMldNUENLUlkwNGNjTnQzc3lOVTdBdGRLZXF5azcKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=',
  })
  @IsOptional()
  @IsString()
  privateKeyBase64?: string;

  @ApiProperty({
    description: 'The raw transaction data object to be encrypted.',
    example: {
      transactionId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 150.5,
      currency: 'USD',
      recipientId: 'user-456',
    },
  })
  @IsObject()
  transactionData: Record<string, unknown>;
}

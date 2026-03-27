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
    description: 'Device ID that will appear in the generated sync payload',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({
    example: 'fkz3F6NUONT8bMRbwfDXM9JU1b+OKi0wp14gQiBRdaE=',
    description:
      'Optional base64-encoded 32-byte AES-256 key. If omitted, constant mock keys are used for Swagger testing.',
  })
  @IsOptional()
  @IsString()
  aesKeyBase64?: string;

  @ApiPropertyOptional({
    description:
      'Optional base64-encoded Ed25519 private key (PKCS8 PEM or raw base64). If omitted, constant mock keys are used for Swagger testing.',
    example: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUVWRUYxakNIdG1qNmphNE1HbE5XQVNYcUpoUU10QzJkYWlGaEtpZGVvUUoKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=',
  })
  @IsOptional()
  @IsString()
  privateKeyBase64?: string;

  @ApiProperty({
    description: 'Plain-text transaction data to encrypt',
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

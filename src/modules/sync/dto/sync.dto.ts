import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class EncryptedPayloadDto {
  @ApiProperty({
    example: 'BASE64_ENCRYPTED_DATA',
    description: 'AES-256-GCM encrypted content (base64)',
  })
  @IsString()
  content: string;

  @ApiProperty({
    example: 'BASE64_IV',
    description: 'Initialization vector (base64) - 12 bytes',
  })
  @IsString()
  iv: string;

  @ApiProperty({
    example: 'BASE64_AUTH_TAG',
    description: 'GCM authentication tag (base64) - 16 bytes',
  })
  @IsString()
  tag: string;
}

export class SyncTransactionDto {
  @ApiProperty({
    example: 'txn-uuid-123',
    description: 'Unique transaction ID for idempotency',
  })
  @IsString()
  transactionId: string;

  @ApiProperty({
    example: 1710000000000,
    description: 'Client timestamp in milliseconds',
  })
  @IsNumber()
  timestamp: number;

  @ApiProperty({
    example: 'random_nonce_123',
    description: 'Unique nonce per transaction to prevent replay attacks',
  })
  @IsString()
  nonce: string;

  @ApiProperty({
    type: EncryptedPayloadDto,
    description: 'The encrypted transaction data',
  })
  @ValidateNested()
  @Type(() => EncryptedPayloadDto)
  payload: EncryptedPayloadDto;

  @ApiProperty({
    example: 'BASE64_SIGNATURE',
    description: 'Ed25519 signature of the canonical JSON string of the transaction payload',
  })
  @IsString()
  signature: string;
}

export class SyncRequestDto {
  @ApiProperty({
    example: 'device-123',
    description: 'The ID of the device sending the transactions',
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    type: [SyncTransactionDto],
    description: 'Array of transactions to be synchronized',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncTransactionDto)
  transactions: SyncTransactionDto[];
}





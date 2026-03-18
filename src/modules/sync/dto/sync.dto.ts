import { IsString, IsArray, ValidateNested, IsNumber, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class SyncPayloadDto {
  @ApiProperty({ example: 'base64-iv', description: 'Initialization vector' })
  @IsString()
  iv: string;

  @ApiProperty({ example: 'encrypted-base64', description: 'Encrypted content' })
  @IsString()
  content: string;

  @ApiProperty({ example: 'base64-auth-tag', description: 'Authentication tag' })
  @IsString()
  tag: string;
}

export class SyncTransactionDto {
  @ApiProperty({ example: 'txn-1234', description: 'Unique transaction ID for idempotency' })
  @IsString()
  transactionId: string;

  @ApiProperty({ example: 1710672000000, description: 'Timestamp' })
  @IsNumber()
  timestamp: number;

  @ApiProperty({ example: 'unique-nonce-abc', description: 'Cryptographic nonce' })
  @IsString()
  nonce: string;

  @ApiProperty({ type: SyncPayloadDto, description: 'Encrypted payload details' })
  @IsObject()
  @ValidateNested()
  @Type(() => SyncPayloadDto)
  payload: SyncPayloadDto;

  @ApiProperty({ example: 'base64-ed25519-signature', description: 'Signature of the request payload' })
  @IsString()
  signature: string;
}

export class SyncRequestDto {
  @ApiProperty({ example: 'device-abc', description: 'Device ID initiating sync' })
  @IsString()
  deviceId: string;

  @ApiProperty({ type: [SyncTransactionDto], description: 'List of transactions to sync' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncTransactionDto)
  transactions: SyncTransactionDto[];
}

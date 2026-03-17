import { IsString, IsArray, ValidateNested, IsNumber, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class SyncPayloadDto {
  @IsString()
  iv: string;

  @IsString()
  content: string;

  @IsString()
  tag: string;
}

export class SyncTransactionDto {
  @IsNumber()
  timestamp: number;

  @IsString()
  nonce: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SyncPayloadDto)
  payload: SyncPayloadDto;

  @IsString()
  signature: string;
}

export class SyncRequestDto {
  @IsString()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncTransactionDto)
  transactions: SyncTransactionDto[];
}

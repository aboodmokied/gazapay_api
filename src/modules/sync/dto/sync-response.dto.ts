import { ApiProperty } from '@nestjs/swagger';

export class SyncResultDto {
  @ApiProperty({ example: 'success', enum: ['success', 'failed'] })
  status: string;

  @ApiProperty({ example: 'random_nonce_123', description: 'The nonce of the transaction' })
  nonce: string;

  @ApiProperty({ example: 'INVALID_SIGNATURE', required: false, description: 'Error message if status is failed' })
  error?: string;
}

export class SyncResponseDto {
  @ApiProperty({ example: 'Sync processed' })
  message: string;

  @ApiProperty({ type: [SyncResultDto], description: 'Results for each transaction in the batch' })
  results: SyncResultDto[];
}

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process batch of offline encrypted transactions',
    description: `
This endpoint receives encrypted transactions from client devices.

Flow:
1. Client encrypts transaction data using AES-256-GCM
2. Client signs canonical JSON string payload using Ed25519
3. Server verifies signature BEFORE decryption
4. Server decrypts and processes transaction

Security:
- Encrypt-then-Sign pattern
- Nonce prevents replay attacks
- AES-GCM ensures integrity + confidentiality
`,
  })
  @ApiBody({
    type: SyncRequestDto,
    description: 'Batch of encrypted & signed transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync processed successfully',
    schema: {
      example: {
        message: 'Sync processed',
        results: [
          { status: 'success', nonce: 'abc123' },
          { status: 'failed', nonce: 'xyz789', error: 'INVALID_SIGNATURE' },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation or payload error' })
  @ApiResponse({ status: 401, description: 'Unauthorized or verification failed' })
  async syncTransactions(@Body() dto: SyncRequestDto) {
    const results = await this.syncService.processSync(dto);
    return { message: 'Sync processed', results };
  }
}
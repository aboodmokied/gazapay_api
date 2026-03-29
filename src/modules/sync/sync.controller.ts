import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync.dto';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { SyncResponseDto } from './dto/sync-response.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process batch of offline encrypted transactions',
    description: `
Receives and processes encrypted transactions from client devices.

### Security Flow:
1. **Device Identification**: Uses \`deviceId\` to look up the device's public keys.
2. **Signature Verification**: Verifies Ed25519 signature of the payload **BEFORE** decryption.
3. **Replay Protection**: Checks \`nonce\` against used nonces in the database.
4. **Decryption**: Decrypts the payload using the device's AES-256-GCM symmetric key.
5. **Processing**: Validates and stores individual transactions.

Returns a status for each transaction in the batch (success or failure with reason).
`,
  })
  @ApiBody({
    type: SyncRequestDto,
    description: 'Batch of encrypted & signed transactions',
  })
  @ApiSuccessResponse(SyncResponseDto)
  @ApiBadRequestResponse({ description: 'Invalid payload structure or validation error' })
  @ApiUnauthorizedResponse({ description: 'Signature verification failed or device not found' })
  async syncTransactions(@Body() dto: SyncRequestDto) {
    const results = await this.syncService.processSync(dto);
    return { message: 'Sync processed', results };
  }
}
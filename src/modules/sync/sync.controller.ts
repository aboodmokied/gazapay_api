import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync.dto';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process batch of offline transactions' })
  @ApiResponse({ status: 200, description: 'Sync processed successfully' })
  @ApiResponse({ status: 400, description: 'Validation or payload error' })
  @ApiResponse({ status: 401, description: 'Unauthorized or verification failed' })
  async syncTransactions(@Body() dto: SyncRequestDto) {
    const results = await this.syncService.processSync(dto);
    return { message: 'Sync processed', results };
  }
}

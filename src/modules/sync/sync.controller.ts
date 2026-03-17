import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncRequestDto } from './dto/sync.dto';


@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async syncTransactions(@Body() dto: SyncRequestDto) {
    const results = await this.syncService.processSync(dto);
    return { message: 'Sync processed', results };
  }
}

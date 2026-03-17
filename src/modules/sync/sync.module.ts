import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaModule } from '../../providers/prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [PrismaModule, CryptoModule, TransactionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}

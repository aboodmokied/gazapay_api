import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './providers/prisma/prisma.module';
// import { RedisModule } from './providers/redis/redis.module';
import configuration from './config/configuration';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import { CryptoModule } from './modules/crypto/crypto.module';
import { DevicesModule } from './modules/devices/devices.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('MyApp', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),
      ],
    }),
    PrismaModule,
    // RedisModule,
    UsersModule,
    AuthModule,
    CryptoModule,
    DevicesModule,
    TransactionsModule,
    SyncModule,
  ],
})
export class AppModule {}

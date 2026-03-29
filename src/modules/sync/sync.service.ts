import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { SyncRequestDto, SyncTransactionDto } from './dto/sync.dto';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async processSync(dto: SyncRequestDto) {
    const { deviceId, transactions } = dto;

    // 1. Retrieve device and its public key
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const aesKeyBase64 = device.aesKey;
    if (!aesKeyBase64) {
      throw new BadRequestException('Symmetric key not setup for device');
    }

    const results = [];

    for (const tx of transactions) {
      try {
        const result = await this.processSingleTransaction(
          device.id,
          device.userId,
          device.publicKey,
          aesKeyBase64,
          tx,
        );
        results.push({
          status: 'success',
          nonce: tx.nonce,
        });
      } catch (error) {
        this.logger.error(`Failed to process tx nonce ${tx.nonce}: ${error.message}`);
        results.push({
          status: 'failed',
          nonce: tx.nonce,
          error: error.response?.message || error.message,
        });
        // We could fail the whole batch, but usually it\'s better to process valid ones
        // or wrap the entire loop in a Prisma transaction if atomic batch is required.
      }
    }

    return results;
  }

  private async processSingleTransaction(
    deviceId: string,
    userId: string,
    publicKey: string,
    aesKey: string,
    tx: SyncTransactionDto,
  ) {
    const { transactionId, timestamp, nonce, payload, signature } = tx;
    const { content, iv, tag } = payload;

    // 2. Reconstruct signature payload
    const payloadToSign = JSON.stringify({
      transactionId,
      content,
      iv,
      tag,
      timestamp,
      nonce
    });

    // 3. Verify Ed25519 signature
    // This MUST happen before decryption to prevent padding oracle attacks and wasted CPU
    try {
      this.cryptoService.verifySignature(publicKey, payloadToSign, signature);
    } catch (e) {
      throw new UnauthorizedException('INVALID_SIGNATURE');
    }

    // 4. Check nonce uniqueness
    const usedNonce = await this.prisma.usedNonce.findUnique({
      where: { nonce_deviceId: { nonce, deviceId } },
    });

    if (usedNonce) {
      throw new UnauthorizedException('NONCE_REUSED');
    }

    // 6. Decrypt payload using AES-256-GCM
    let decryptedString: string;
    try {
      decryptedString = this.cryptoService.decryptPayload(content, iv, tag, aesKey);
    } catch (e) {
      throw new UnauthorizedException('DECRYPTION_FAILED');
    }

    // 7. Parse decrypted JSON safely
    let parsedData: any;
    try {
      parsedData = JSON.parse(decryptedString);
    } catch (e) {
      throw new BadRequestException('INVALID_PAYLOAD');
    }

    // 8. Validate schema (amount, transactionId, etc.)
    // Basic structural validation
    if (!parsedData.transactionId || typeof parsedData.amount !== 'number') {
      throw new BadRequestException('INVALID_PAYLOAD_SCHEMA');
    }

    // Process everything in a db transaction to ensure atomicity
    await this.prisma.$transaction(async (prismaTx) => {
      // 9. Store transaction in database
      await prismaTx.transaction.upsert({
        where: { id: transactionId },
        update: {},
        create: {
          id: transactionId,
          userId: userId,
          deviceId: deviceId,
          content: decryptedString,
          iv: iv,
          tag: tag,
          timestamp: new Date(timestamp), // Keep original timestamp
        },
      });

      // 10. Store nonce in UsedNonces table
      await prismaTx.usedNonce.upsert({
        where: { nonce_deviceId: { nonce, deviceId } },
        update: {},
        create: {
          nonce,
          deviceId: deviceId,
        },
      });
    });

    return parsedData;
  }
}


// TODO: validate signature before decryption
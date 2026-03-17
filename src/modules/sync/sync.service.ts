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

  // Allow a 5-minute window for timestamps
  private readonly ALLOWED_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

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
      include: { user: { include: { privateKey: true } } }, // In real life, maybe get an AES key associated with the device or user
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Usually AES key is shared per user or per device during registration or login.
    // For this example, assuming the User\'s PrivateKey record stores the symmetric key.
    const aesKeyBase64 = device.user.privateKey?.key;
    if (!aesKeyBase64) {
      throw new BadRequestException('Symmetric key not setup for user');
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
    const { timestamp, nonce, payload, signature } = tx;
    const { content, iv, tag } = payload;

    // 2. Reconstruct message hash
    const hash = this.cryptoService.hashPayload(content, iv, tag, timestamp, nonce);

    // 3. Verify Ed25519 signature
    // This MUST happen before decryption to prevent padding oracle attacks and wasted CPU
    try {
      this.cryptoService.verifySignature(publicKey, hash, signature);
    } catch (e) {
      throw new UnauthorizedException('INVALID_SIGNATURE');
    }

    // 4. Check nonce uniqueness
    const usedNonce = await this.prisma.usedNonce.findUnique({
      where: { nonce },
    });

    if (usedNonce) {
      throw new UnauthorizedException('NONCE_REUSED');
    }

    // 5. Validate timestamp
    const now = Date.now();
    if (Math.abs(now - timestamp) > this.ALLOWED_TIMESTAMP_WINDOW_MS) {
      // In a truly offline scenario, devices might sync hours later.
      // EITHER use a wide window, reliance on nonce, or a monotonic counter.
      // For this requirement: reject if outside allowed window
      throw new UnauthorizedException('INVALID_TIMESTAMP');
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
      await prismaTx.transaction.create({
        // For simplicity, using same Prisma models via TransactionsService logic,
        // but since we need atomicity inside this $transaction, we use prismaTx directly
        data: {
          id: parsedData.transactionId,
          userId: userId,
          deviceId: deviceId,
          content: decryptedString,
          iv: iv,
          tag: tag,
          timestamp: new Date(timestamp), // Keep original timestamp
        },
      });

      // 10. Store nonce in UsedNonces table
      await prismaTx.usedNonce.create({
        data: {
          nonce,
          deviceId: deviceId,
        },
      });
    });

    return parsedData;
  }
}

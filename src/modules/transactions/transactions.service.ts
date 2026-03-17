import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async saveTransaction(data: {
    id: string; // From the decrypted payload
    userId: string;
    deviceId: string;
    content: string; // the raw decrypted JSON or string
    iv: string;
    tag: string;
    timestamp: Date;
  }) {
    // In a real scenario, you'd parse `content` and perhaps update user balances, 
    // but for the sake of the requirement, we store the transaction record.

    return this.prisma.transaction.create({
      data: {
        id: data.id,
        userId: data.userId,
        deviceId: data.deviceId,
        content: data.content,
        iv: data.iv,
        tag: data.tag,
        timestamp: data.timestamp,
      },
    });
  }
}

import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import * as crypto from 'crypto';
import { SimulateEncryptionDto } from './dto/simulate-encryption.dto';

@ApiTags('Crypto')
@Controller('crypto')
export class CryptoController {
  // Constant keys for Swagger/testing – same keys are hardcoded in the sync service stub.
  private static readonly TEST_AES_KEY_BASE64 = 'fkz3F6NUONT8bMRbwfDXM9JU1b+OKi0wp14gQiBRdaE=';
  private static readonly TEST_PRIVATE_KEY_BASE64 =
    'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUVWRUYxakNIdG1qNmphNE1HbE5XQVNYcUpoUU10QzJkYWlGaEtpZGVvUUoKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=';

  /**
   * POST /crypto/simulate-encryption
   *
   * Simulates what a real client would do before calling POST /sync:
   *  1. Generate (or accept) an Ed25519 key pair
   *  2. Generate (or accept) a 32-byte AES-256-GCM key
   *  3. Encrypt transactionData with AES-256-GCM  → { content, iv, tag }
   *  4. Build the JSON string dictionary: { transactionId, content, iv, tag, timestamp, nonce }
   *  5. Sign the canonical JSON string with the Ed25519 private key
   *  6. Return the full sync-ready payload PLUS the keys for use in subsequent /sync calls
   */
  @Post('simulate-encryption')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate the client-side encryption process',
    description: `
Generates a fully signed & encrypted transaction payload, exactly as a real
client device would produce before calling \`POST /sync\`.

**Steps performed internally:**
1. Generate (or use supplied) Ed25519 key pair
2. Generate (or use supplied) 32-byte AES-256-GCM key
3. Encrypt \`transactionData\` → \`{ content, iv, tag }\`
4. Build signature payload: \`JSON.stringify({ transactionId, content, iv, tag, timestamp, nonce })\`
5. Sign the JSON string directly with Ed25519 private key
6. Return the complete sync payload + public key + AES key (for device registration)

Use the returned \`syncPayload\` directly as the body for \`POST /sync\`.
Use \`publicKeyPem\` when registering the device via \`POST /devices\`.
`,
  })
  @ApiBody({ type: SimulateEncryptionDto })
  @ApiResponse({
    status: 200,
    description: 'Simulated encrypted payload ready to be sent to POST /sync',
    schema: {
      example: {
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAK1AdzgOZ+6tWEyuY0CDOU3B1538nagQIOMKf8UlrggI=\n-----END PUBLIC KEY-----\n',
        aesKeyBase64: 'fkz3F6NUONT8bMRbwfDXM9JU1b+OKi0wp14gQiBRdaE=',
        syncPayload: {
          deviceId: '1',
          transactions: [
            {
              transactionId: '550e8400-e29b-41d4-a716-446655440000',
              timestamp: 1710000000000,
              nonce: '36baea08-c84b-4f0f-8c01-7299bdcfa1f3',
              payload: {
                content: 'SskJQnUafGSMgL3wZziKl58gH7LL+dEXMF62K+V+cJJQiczUHG+u5fr89xR4XEAPk/xWE10WloA53oWLIUMSQKcHmAHs3IfXf+uYjwjWUzal0VHuSY25k6tUPunqUbThNQZaHhEK20RI5CJiReZsgnw=',
                iv: 'DAr268DHUTnMc4e9',
                tag: 'r7rwxscsmIMGHoMIkzXV0g==',
              },
              signature: 'seReAAvmyzdpHJ2PVyu75KaB7dFtOtYhhKhbcDzU1eVT9OF+9p78MCPDQI7dlJisT28Hv2lpsMAV4S+6QSjRBA==',
            },
          ],
        },
      },
    },
  })
  simulateEncryption(@Body() dto: SimulateEncryptionDto) {
    // ── 1. Key material ──────────────────────────────────────────────────────
    let aesKey: Buffer;
    let publicKeyPem: string;
    let privateKey: crypto.KeyObject;

    // Fall back to constant test keys when caller omits them
    const aesKeyBase64 = dto.aesKeyBase64 ?? CryptoController.TEST_AES_KEY_BASE64;
    const privateKeyBase64Input = dto.privateKeyBase64 ?? CryptoController.TEST_PRIVATE_KEY_BASE64;

    aesKey = Buffer.from(aesKeyBase64, 'base64');
    if (aesKey.length !== 32) {
      throw new BadRequestException('aesKeyBase64 must decode to exactly 32 bytes');
    }

    // Decode private key PEM from base64
    const pem = Buffer.from(privateKeyBase64Input, 'base64').toString('utf8');
    privateKey = crypto.createPrivateKey(pem);
    const pub = crypto.createPublicKey(privateKey);
    publicKeyPem = pub.export({ type: 'spki', format: 'pem' }) as string;

    // ── 2. Envelope fields ───────────────────────────────────────────────────
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const transactionId =
      (dto.transactionData.transactionId as string) ?? crypto.randomUUID();

    // ── 3. Encrypt payload with AES-256-GCM ──────────────────────────────────
    const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    let encryptedContent = cipher.update(
      JSON.stringify(dto.transactionData),
      'utf8',
      'base64',
    );
    encryptedContent += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    const payload = {
      content: encryptedContent,
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
    };

    // ── 4. Build the canonical string to sign (must match sync.service.ts exactly) ──
    const payloadToSign = JSON.stringify({
      transactionId,
      content: payload.content,
      iv: payload.iv,
      tag: payload.tag,
      timestamp,
      nonce,
    });

    // ── 5. Sign with Ed25519 ────────────────────────────────────────────────
    const signature = crypto
      .sign(null, Buffer.from(payloadToSign, 'utf8'), privateKey)
      .toString('base64');

    // ── 6. Build the sync-ready response ────────────────────────────────────
    return {
      /** Use this when registering the device via POST /devices */
      // publicKeyPem,
      /** Store/use this as the device's AES key (user.privateKey.key in tests) */
      // aesKeyBase64: aesKey.toString('base64'),
      /** Send this body directly to POST /sync */
      // syncPayload: {
        deviceId: dto.deviceId,
        transactions: [
          {
            transactionId,
            timestamp,
            nonce,
            payload,
            signature,
          },
        ],
      // },
    };
  }
}

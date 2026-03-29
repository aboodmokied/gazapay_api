import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SimulateEncryptionDto } from './dto/simulate-encryption.dto';

@Injectable()
export class CryptoService {
  /**
   * Generate a fresh Ed25519 key pair
   */
  generateEd25519KeyPair(): { publicKeyPem: string; privateKey: crypto.KeyObject } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
      privateKey,
    };
  }

  /**
   * Sign a UTF-8 payload using Ed25519 private key
   */
  signPayload(payloadToSign: string, privateKey: crypto.KeyObject | string): string {
    return crypto.sign(null, Buffer.from(payloadToSign, 'utf8'), privateKey).toString('base64');
  }

  /**
   * Encrypt a JSON object using AES-256-GCM
   */
  encryptPayload(
    data: any,
    aesKey: Buffer,
  ): { content: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(12); // Recommended 96-bit nonce for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    
    let encryptedContent = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encryptedContent += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      content: encryptedContent,
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
    };
  }

  /**
   * Consolidates the logic for simulating a client-side encryption process.
   * Useful for end-to-end testing and API documentation.
   */
  simulateClientEncryption(dto: SimulateEncryptionDto) {
    let aesKey: Buffer;
    let publicKeyPem: string;
    let privateKey: crypto.KeyObject;

    // 1. Handle AES Key
    if (dto.aesKeyBase64) {
      aesKey = Buffer.from(dto.aesKeyBase64, 'base64');
      if (aesKey.length !== 32) {
        throw new BadRequestException('aesKeyBase64 must decode to exactly 32 bytes');
      }
    } else {
      aesKey = crypto.randomBytes(32);
    }

    // 2. Handle Ed25519 Keys
    if (dto.privateKeyBase64) {
      try {
        let pem = dto.privateKeyBase64;
        if (!pem.startsWith('-----BEGIN')) {
          pem = Buffer.from(pem, 'base64').toString('utf8');
        }
        privateKey = crypto.createPrivateKey(pem);
        const pub = crypto.createPublicKey(privateKey);
        publicKeyPem = pub.export({ type: 'spki', format: 'pem' }) as string;
      } catch (err) {
        throw new BadRequestException('Invalid Ed25519 private key provided');
      }
    } else {
      const generated = this.generateEd25519KeyPair();
      publicKeyPem = generated.publicKeyPem;
      privateKey = generated.privateKey;
    }

    // 3. Encrypt data
    const encryptionResult = this.encryptPayload(dto.transactionData, aesKey);
    const transactionId = (dto.transactionData.transactionId as string) ?? crypto.randomUUID();
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    // 4. Build message to sign (must be canonical order for verification)
    const payloadToSign = JSON.stringify({
      transactionId,
      content: encryptionResult.content,
      iv: encryptionResult.iv,
      tag: encryptionResult.tag,
      timestamp,
      nonce,
    });

    // 5. Sign payload
    const signature = this.signPayload(payloadToSign, privateKey);

    return {
      publicKeyPem,
      aesKeyBase64: aesKey.toString('base64'),
      syncPayload: {
        deviceId: dto.deviceId,
        transactions: [
          {
            transactionId,
            timestamp,
            nonce,
            payload: encryptionResult,
            signature,
          },
        ],
      },
    };
  }

  /**
   * Verify Ed25519 signature
   */
  verifySignature(
    publicKeyPem: string,
    payloadToSign: string,
    signatureBase64: string,
  ): boolean {
    try {
      const isVerified = crypto.verify(
        null,
        Buffer.from(payloadToSign, 'utf8'),
        publicKeyPem,
        Buffer.from(signatureBase64, 'base64'),
      );
      
      if (!isVerified) {
        throw new Error('Signature mismatch');
      }
      return true;
    } catch (error) {
      throw new UnauthorizedException('INVALID_SIGNATURE');
    }
  }

  /**
   * Decrypt AES-256-GCM payload
   */
  decryptPayload(
    encryptedContentBase64: string,
    ivBase64: string,
    tagBase64: string,
    aesKey: Buffer | string,
  ): string {
    try {
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');
      const key = typeof aesKey === 'string' ? Buffer.from(aesKey, 'base64') : aesKey;
      const content = Buffer.from(encryptedContentBase64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(content, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new UnauthorizedException('DECRYPTION_FAILED');
    }
  }
}

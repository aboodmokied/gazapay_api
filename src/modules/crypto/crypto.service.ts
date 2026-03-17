import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  /**
   * Reconstruct message hash
   * hash = SHA256(content + iv + tag + timestamp + nonce)
   */
  hashPayload(
    content: string,
    iv: string,
    tag: string,
    timestamp: number,
    nonce: string,
  ): string {
    const dataToHash = `${content}${iv}${tag}${timestamp}${nonce}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Verify Ed25519 signature
   */
  verifySignature(
    publicKeyPem: string,
    hash: string,
    signatureBase64: string,
  ): boolean {
    try {
      const isVerified = crypto.verify(
        null, // null for Ed25519, the algo is determined by the key
        Buffer.from(hash, 'hex'),
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
    aesKey: Buffer | string, // 32-byte key
  ): string {
    try {
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');
      const key = typeof aesKey === 'string' ? Buffer.from(aesKey, 'base64') : aesKey; // Decode key if it's base64, adjust based on how you store it
      const content = Buffer.from(encryptedContentBase64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(content, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Any AES-GCM auth failure must reject immediately
      throw new UnauthorizedException('DECRYPTION_FAILED');
    }
  }
}

import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';

// ---------------------------------------------------------------------------
// Client-side simulation helpers
//
// The real client:
//   1. AES-256-GCM encrypts the plaintext payload  →  { content, iv, tag }
//   2. Builds a deterministic envelope to sign:
//        JSON.stringify({ transactionId, content, iv, tag, timestamp, nonce })
//   3. Ed25519-signs the envelope string
//
// These helpers replicate that exact flow so the tests exercise the same
// cryptographic paths that the server's CryptoService will see in production.
// ---------------------------------------------------------------------------

// ── Key-pair helper ─────────────────────────────────────────────────────────

function generateEd25519KeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

// ── Encryption (step 1) ─────────────────────────────────────────────────────

interface AesEncryptResult {
  /** raw 32-byte key, kept as a Buffer for direct use in decryptPayload tests */
  key: Buffer;
  keyBase64: string;
  ivBase64: string;
  tagBase64: string;
  contentBase64: string;
}

function aesEncrypt(plaintext: string, key?: Buffer): AesEncryptResult {
  const k = key ?? crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    key: k,
    keyBase64: k.toString('base64'),
    ivBase64: iv.toString('base64'),
    tagBase64: cipher.getAuthTag().toString('base64'),
    contentBase64: encrypted.toString('base64'),
  };
}

// ── Envelope builder (step 2) ───────────────────────────────────────────────

interface TransactionEnvelope {
  transactionId: string;
  content: string;
  iv: string;
  tag: string;
  timestamp: number;
  nonce: string;
}

/**
 * Builds the exact string that the client signs and the server reconstructs
 * inside processSingleTransaction() before calling verifySignature().
 */
function buildEnvelope(params: TransactionEnvelope): string {
  const { transactionId, content, iv, tag, timestamp, nonce } = params;
  return JSON.stringify({ transactionId, content, iv, tag, timestamp, nonce });
}

// ── Signing (step 3) ────────────────────────────────────────────────────────

function ed25519Sign(privateKeyPem: string, data: string): string {
  return crypto
    .sign(null, Buffer.from(data, 'utf8'), privateKeyPem)
    .toString('base64');
}

// ── Full client transaction simulator ───────────────────────────────────────

interface SimulatedTransaction {
  transactionId: string;
  timestamp: number;
  nonce: string;
  payload: { content: string; iv: string; tag: string };
  signature: string;
  /** The AES key that was used – the server retrieves this from the DB */
  aesKey: Buffer;
  aesKeyBase64: string;
  /** The envelope string that was signed (useful for tamper tests) */
  signedEnvelope: string;
}

/**
 * Simulates the full client-side encryption + signing pipeline.
 *
 * @param privateKeyPem  Client's Ed25519 private key
 * @param plaintextJson  The JSON object the client wants to securely transmit
 * @param aesKey         Optional fixed 32-byte AES key (random if omitted)
 */
function simulateClientTransaction(
  privateKeyPem: string,
  plaintextJson: object,
  aesKey?: Buffer,
): SimulatedTransaction {
  const transactionId = crypto.randomUUID();
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  // 1. AES-encrypt
  const enc = aesEncrypt(JSON.stringify(plaintextJson), aesKey);

  // 2. Build envelope
  const envelope = buildEnvelope({
    transactionId,
    content: enc.contentBase64,
    iv: enc.ivBase64,
    tag: enc.tagBase64,
    timestamp,
    nonce,
  });

  // 3. Sign
  const signature = ed25519Sign(privateKeyPem, envelope);

  return {
    transactionId,
    timestamp,
    nonce,
    payload: {
      content: enc.contentBase64,
      iv: enc.ivBase64,
      tag: enc.tagBase64,
    },
    signature,
    aesKey: enc.key,
    aesKeyBase64: enc.keyBase64,
    signedEnvelope: envelope,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoService],
    }).compile();
    service = module.get<CryptoService>(CryptoService);
  });

  // -------------------------------------------------------------------------
  // verifySignature – the server calls this with the *encrypted* envelope,
  // exactly as rebuilt inside SyncService.processSingleTransaction()
  // -------------------------------------------------------------------------
  describe('verifySignature()', () => {
    let publicKeyPem: string;
    let privateKeyPem: string;
    let tx: SimulatedTransaction;

    beforeEach(() => {
      ({ publicKey: publicKeyPem, privateKey: privateKeyPem } =
        generateEd25519KeyPair());

      // Simulate what the client sends
      tx = simulateClientTransaction(privateKeyPem, {
        transactionId: 'tx-1',
        amount: 100,
        currency: 'USD',
      });
    });

    it('should return true for a valid Ed25519 signature over the encrypted envelope', () => {
      // Server reconstructs the same envelope then calls verifySignature
      const reconstructed = buildEnvelope({
        transactionId: tx.transactionId,
        content: tx.payload.content,
        iv: tx.payload.iv,
        tag: tx.payload.tag,
        timestamp: tx.timestamp,
        nonce: tx.nonce,
      });

      const result = service.verifySignature(
        publicKeyPem,
        reconstructed,
        tx.signature,
      );
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when the signature is wrong', () => {
      const badSignature = Buffer.from('invalidsignature').toString('base64');
      expect(() =>
        service.verifySignature(publicKeyPem, tx.signedEnvelope, badSignature),
      ).toThrow(new UnauthorizedException('INVALID_SIGNATURE'));
    });

    it('should throw UnauthorizedException when the encrypted content is tampered', () => {
      // Attacker flips a byte in the encrypted content field
      const tamperedEnvelope = tx.signedEnvelope.replace(
        tx.payload.content,
        // replace first character of the base64 ciphertext with a different one
        tx.payload.content[0] === 'A' ? 'B' + tx.payload.content.slice(1)
                                       : 'A' + tx.payload.content.slice(1),
      );
      expect(() =>
        service.verifySignature(publicKeyPem, tamperedEnvelope, tx.signature),
      ).toThrow(new UnauthorizedException('INVALID_SIGNATURE'));
    });

    it('should throw UnauthorizedException when the public key is invalid', () => {
      expect(() =>
        service.verifySignature('not-a-pem-key', tx.signedEnvelope, tx.signature),
      ).toThrow(new UnauthorizedException('INVALID_SIGNATURE'));
    });

    it('should throw UnauthorizedException when a different key pair is used', () => {
      const { privateKey: otherPrivateKey } = generateEd25519KeyPair();
      // Build a new tx with the OTHER key but keep the same envelope structure
      const txOther = simulateClientTransaction(otherPrivateKey, {
        transactionId: 'tx-1',
        amount: 100,
      });
      expect(() =>
        // Verify the other-key signature against the first tx's public key
        service.verifySignature(publicKeyPem, txOther.signedEnvelope, txOther.signature),
      ).toThrow(new UnauthorizedException('INVALID_SIGNATURE'));
    });

    it('should throw when the nonce is tampered (replay-attempt with modified nonce)', () => {
      // Build a modified envelope with a different nonce (replay-prevention check)
      const modifiedEnvelope = buildEnvelope({
        transactionId: tx.transactionId,
        content: tx.payload.content,
        iv: tx.payload.iv,
        tag: tx.payload.tag,
        timestamp: tx.timestamp,
        nonce: 'different-nonce-value',   // ← tampered
      });
      expect(() =>
        service.verifySignature(publicKeyPem, modifiedEnvelope, tx.signature),
      ).toThrow(new UnauthorizedException('INVALID_SIGNATURE'));
    });
  });

  // -------------------------------------------------------------------------
  // decryptPayload – uses the AES key that the server has on file,
  // decrypting the ciphertext produced by the real client encryption step
  // -------------------------------------------------------------------------
  describe('decryptPayload()', () => {
    const plaintextObject = { transactionId: 'tx-1', amount: 50 };
    const plaintext = JSON.stringify(plaintextObject);

    it('should decrypt valid AES-256-GCM ciphertext back to the original plaintext', () => {
      // Simulate client encrypting the payload
      const { keyBase64, ivBase64, tagBase64, contentBase64 } =
        aesEncrypt(plaintext);

      const result = service.decryptPayload(
        contentBase64,
        ivBase64,
        tagBase64,
        keyBase64,
      );
      expect(result).toBe(plaintext);
    });

    it('should correctly decrypt a full client-simulated transaction payload', () => {
      const { publicKey: _pub, privateKey } = generateEd25519KeyPair();
      const tx = simulateClientTransaction(privateKey, plaintextObject);

      // Server decrypts using the stored AES key
      const decrypted = service.decryptPayload(
        tx.payload.content,
        tx.payload.iv,
        tx.payload.tag,
        tx.aesKeyBase64,
      );

      expect(JSON.parse(decrypted)).toEqual(plaintextObject);
    });

    it('should accept the AES key as a raw Buffer', () => {
      const key = crypto.randomBytes(32);
      const enc = aesEncrypt(plaintext, key);

      const result = service.decryptPayload(
        enc.contentBase64,
        enc.ivBase64,
        enc.tagBase64,
        key, // Buffer, not base64 string
      );
      expect(result).toBe(plaintext);
    });

    it('should throw UnauthorizedException when the auth tag is tampered', () => {
      const { keyBase64, ivBase64, contentBase64 } = aesEncrypt(plaintext);
      const badTag = crypto.randomBytes(16).toString('base64');
      expect(() =>
        service.decryptPayload(contentBase64, ivBase64, badTag, keyBase64),
      ).toThrow(new UnauthorizedException('DECRYPTION_FAILED'));
    });

    it('should throw UnauthorizedException when the IV is wrong', () => {
      const { keyBase64, tagBase64, contentBase64 } = aesEncrypt(plaintext);
      const badIv = crypto.randomBytes(12).toString('base64');
      expect(() =>
        service.decryptPayload(contentBase64, badIv, tagBase64, keyBase64),
      ).toThrow(new UnauthorizedException('DECRYPTION_FAILED'));
    });

    it('should throw UnauthorizedException when the ciphertext is corrupted', () => {
      const { keyBase64, ivBase64, tagBase64 } = aesEncrypt(plaintext);
      const badContent = crypto.randomBytes(32).toString('base64');
      expect(() =>
        service.decryptPayload(badContent, ivBase64, tagBase64, keyBase64),
      ).toThrow(new UnauthorizedException('DECRYPTION_FAILED'));
    });

    it('should throw UnauthorizedException when the key is wrong', () => {
      const { ivBase64, tagBase64, contentBase64 } = aesEncrypt(plaintext);
      const wrongKey = crypto.randomBytes(32).toString('base64');
      expect(() =>
        service.decryptPayload(contentBase64, ivBase64, tagBase64, wrongKey),
      ).toThrow(new UnauthorizedException('DECRYPTION_FAILED'));
    });
  });
});

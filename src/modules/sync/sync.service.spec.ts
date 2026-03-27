import * as crypto from 'crypto';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

// ---------------------------------------------------------------------------
// Crypto helpers (same pattern as crypto.service.spec.ts)
// ---------------------------------------------------------------------------

function generateEd25519KeyPair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function ed25519Sign(privateKeyPem: string, data: string): string {
  return crypto
    .sign(null, Buffer.from(data, 'utf8'), privateKeyPem)
    .toString('base64');
}

function aesEncrypt(
  key: Buffer,
  plaintext: string,
): { iv: string; tag: string; content: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    content: encrypted.toString('base64'),
  };
}

// ---------------------------------------------------------------------------
// Shared fixture builder
// ---------------------------------------------------------------------------

function buildValidTransaction(
  privateKeyPem: string,
  aesKey: Buffer,
  overrides: Partial<{
    transactionId: string;
    nonce: string;
    amount: number;
    payloadOverride: { iv: string; tag: string; content: string };
    signatureOverride: string;
  }> = {},
) {
  const transactionId = overrides.transactionId ?? 'tx-uuid-1';
  const nonce = overrides.nonce ?? 'nonce-abc';
  const timestamp = Date.now();
  const amount = overrides.amount ?? 42;

  const plainPayload = JSON.stringify({ transactionId, amount });
  const encrypted =
    overrides.payloadOverride ?? aesEncrypt(aesKey, plainPayload);

  const { iv, tag, content } = encrypted;

  const payloadToSign = JSON.stringify({
    transactionId,
    content,
    iv,
    tag,
    timestamp,
    nonce,
  });

  const signature =
    overrides.signatureOverride ?? ed25519Sign(privateKeyPem, payloadToSign);

  return {
    transactionId,
    timestamp,
    nonce,
    payload: { iv, tag, content },
    signature,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncService', () => {
  let service: SyncService;
  let prisma: jest.Mocked<PrismaService>;
  let cryptoService: CryptoService; // real instance for some tests

  // Ed25519 key pair and AES key shared across tests
  let publicKeyPem: string;
  let privateKeyPem: string;
  let aesKey: Buffer;
  let aesKeyBase64: string;

  beforeAll(() => {
    ({ publicKey: publicKeyPem, privateKey: privateKeyPem } =
      generateEd25519KeyPair());
    aesKey = crypto.randomBytes(32);
    aesKeyBase64 = aesKey.toString('base64');
  });

  // Build the NestJS test module before each test so mocks are reset
  beforeEach(async () => {
    const prismaMock = {
      device: { findUnique: jest.fn() },
      usedNonce: { findUnique: jest.fn(), upsert: jest.fn() },
      transaction: { upsert: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        CryptoService, // real crypto service
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: TransactionsService,
          useValue: {}, // not exercised here
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    prisma = module.get(PrismaService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  // -------------------------------------------------------------------------
  // Helpers that configure prisma mock to simulate a valid device
  // -------------------------------------------------------------------------
  function setupValidDevice() {
    (prisma.device.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'device-1',
      userId: 'user-1',
      publicKey: publicKeyPem,
      user: {
        privateKey: { key: aesKeyBase64 },
      },
    });
  }

  function setupPrismaTransaction(nonceExists = false) {
    (prisma.usedNonce.findUnique as jest.Mock).mockResolvedValueOnce(
      nonceExists ? { id: 'n1', nonce: 'nonce-abc', deviceId: 'device-1' } : null,
    );
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      const prismaTx = {
        transaction: { upsert: jest.fn().mockResolvedValue({}) },
        usedNonce: { upsert: jest.fn().mockResolvedValue({}) },
      };
      return cb(prismaTx);
    });
  }

  // -------------------------------------------------------------------------
  // Device lookup failures
  // -------------------------------------------------------------------------
  it('should throw NotFoundException when the device does not exist', async () => {
    (prisma.device.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      service.processSync({ deviceId: 'ghost-device', transactions: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when the user has no AES key', async () => {
    (prisma.device.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'device-1',
      userId: 'user-1',
      publicKey: publicKeyPem,
      user: { privateKey: null },
    });

    await expect(
      service.processSync({ deviceId: 'device-1', transactions: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------
  it('should return status "success" for a valid transaction', async () => {
    setupValidDevice();
    setupPrismaTransaction(false);

    const tx = buildValidTransaction(privateKeyPem, aesKey);
    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [tx],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'success', nonce: tx.nonce });
  });

  it('should process multiple transactions independently', async () => {
    (prisma.device.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'device-1',
      userId: 'user-1',
      publicKey: publicKeyPem,
      user: { privateKey: { key: aesKeyBase64 } },
    });

    const tx1 = buildValidTransaction(privateKeyPem, aesKey, {
      transactionId: 'tx-1',
      nonce: 'nonce-1',
    });
    const tx2 = buildValidTransaction(privateKeyPem, aesKey, {
      transactionId: 'tx-2',
      nonce: 'nonce-2',
    });

    // nonce lookup returns null (not reused) for both
    (prisma.usedNonce.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      const prismaTx = {
        transaction: { upsert: jest.fn().mockResolvedValue({}) },
        usedNonce: { upsert: jest.fn().mockResolvedValue({}) },
      };
      return cb(prismaTx);
    });

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [tx1, tx2],
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'success')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Error paths (per-transaction, returned as "failed" not a thrown exception)
  // -------------------------------------------------------------------------
  it('should return "failed" with INVALID_SIGNATURE when the signature is wrong', async () => {
    setupValidDevice();

    const tx = buildValidTransaction(privateKeyPem, aesKey, {
      signatureOverride: Buffer.from('bad').toString('base64'),
    });

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [tx],
    });

    expect(results[0]).toMatchObject({
      status: 'failed',
      nonce: tx.nonce,
      error: 'INVALID_SIGNATURE',
    });
  });

  it('should return "failed" with NONCE_REUSED when the nonce was already used', async () => {
    setupValidDevice();
    setupPrismaTransaction(true); // nonce exists in DB

    const tx = buildValidTransaction(privateKeyPem, aesKey);
    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [tx],
    });

    expect(results[0]).toMatchObject({
      status: 'failed',
      nonce: tx.nonce,
      error: 'NONCE_REUSED',
    });
  });

  it('should return "failed" with DECRYPTION_FAILED when the ciphertext is tampered', async () => {
    setupValidDevice();
    // nonce not reused
    (prisma.usedNonce.findUnique as jest.Mock).mockResolvedValueOnce(null);

    // Build tx with valid signature but wrong tag (will fail GCM auth)
    const iv = crypto.randomBytes(12).toString('base64');
    const content = crypto.randomBytes(32).toString('base64');
    const tag = crypto.randomBytes(16).toString('base64'); // wrong tag

    const transactionId = 'tx-tampered';
    const nonce = 'nonce-tampered';
    const timestamp = Date.now();
    const payloadToSign = JSON.stringify({
      transactionId,
      content,
      iv,
      tag,
      timestamp,
      nonce,
    });
    const signature = ed25519Sign(privateKeyPem, payloadToSign);

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [{ transactionId, timestamp, nonce, payload: { iv, tag, content }, signature }],
    });

    expect(results[0]).toMatchObject({
      status: 'failed',
      nonce,
      error: 'DECRYPTION_FAILED',
    });
  });

  it('should return "failed" with INVALID_PAYLOAD when the decrypted content is not valid JSON', async () => {
    setupValidDevice();
    (prisma.usedNonce.findUnique as jest.Mock).mockResolvedValueOnce(null);

    // Encrypt a non-JSON string
    const { iv, tag, content } = aesEncrypt(aesKey, 'not-json-!!');
    const transactionId = 'tx-bad-json';
    const nonce = 'nonce-bad-json';
    const timestamp = Date.now();
    const payloadToSign = JSON.stringify({ transactionId, content, iv, tag, timestamp, nonce });
    const signature = ed25519Sign(privateKeyPem, payloadToSign);

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [{ transactionId, timestamp, nonce, payload: { iv, tag, content }, signature }],
    });

    expect(results[0]).toMatchObject({
      status: 'failed',
      nonce,
      error: 'INVALID_PAYLOAD',
    });
  });

  it('should return "failed" with INVALID_PAYLOAD_SCHEMA when required fields are missing', async () => {
    setupValidDevice();
    (prisma.usedNonce.findUnique as jest.Mock).mockResolvedValueOnce(null);

    // Valid JSON but missing `transactionId` and `amount`
    const { iv, tag, content } = aesEncrypt(aesKey, JSON.stringify({ foo: 'bar' }));
    const transactionId = 'tx-bad-schema';
    const nonce = 'nonce-bad-schema';
    const timestamp = Date.now();
    const payloadToSign = JSON.stringify({ transactionId, content, iv, tag, timestamp, nonce });
    const signature = ed25519Sign(privateKeyPem, payloadToSign);

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [{ transactionId, timestamp, nonce, payload: { iv, tag, content }, signature }],
    });

    expect(results[0]).toMatchObject({
      status: 'failed',
      nonce,
      error: 'INVALID_PAYLOAD_SCHEMA',
    });
  });

  it('should continue processing remaining transactions even if one fails', async () => {
    (prisma.device.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'device-1',
      userId: 'user-1',
      publicKey: publicKeyPem,
      user: { privateKey: { key: aesKeyBase64 } },
    });

    const badTx = buildValidTransaction(privateKeyPem, aesKey, {
      transactionId: 'tx-bad',
      nonce: 'nonce-bad',
      signatureOverride: 'invalidsig==',
    });
    const goodTx = buildValidTransaction(privateKeyPem, aesKey, {
      transactionId: 'tx-good',
      nonce: 'nonce-good',
    });

    (prisma.usedNonce.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        transaction: { upsert: jest.fn().mockResolvedValue({}) },
        usedNonce: { upsert: jest.fn().mockResolvedValue({}) },
      });
    });

    const results = await service.processSync({
      deviceId: 'device-1',
      transactions: [badTx, goodTx],
    });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('failed');
    expect(results[1].status).toBe('success');
  });
});

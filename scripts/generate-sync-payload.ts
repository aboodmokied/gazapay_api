import * as crypto from 'crypto';

// 1. Generate keys for the device (Ed25519)
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

// 2. Generate a symmetric key for AES-256-GCM (usually derived or shared during auth)
const aesKey = crypto.randomBytes(32);
const aesKeyBase64 = aesKey.toString('base64');

// 3. Prepare payload
const timestamp = Date.now();
const nonce = crypto.randomUUID();
const transactionData = {
  transactionId: crypto.randomUUID(),
  amount: 150.50,
  currency: 'USD',
  recipientId: 'user-456'
};

// 4. Encrypt payload
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
let encryptedContent = cipher.update(JSON.stringify(transactionData), 'utf8', 'base64');
encryptedContent += cipher.final('base64');
const tag = cipher.getAuthTag();

// The encrypted parts
const payload = {
  content: encryptedContent,
  iv: iv.toString('base64'),
  tag: tag.toString('base64')
};

// 5. Hash and Sign
// String to hash: content + iv + tag + timestamp + nonce
const dataToHash = `${payload.content}${payload.iv}${payload.tag}${timestamp}${nonce}`;
const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

const signature = crypto.sign(null, Buffer.from(hash, 'hex'), privateKey).toString('base64');

// 6. Output the request bodies
console.log('--- DEVICE REGISTRATION REQUEST ---');
console.log(JSON.stringify({
  userId: 'user-123',
  deviceId: 'device-abc',
  publicKey: publicKeyPem
}, null, 2));

console.log('\n--- SYNC REQUEST ---');
console.log(JSON.stringify({
  deviceId: 'device-abc',
  transactions: [
    {
      timestamp,
      nonce,
      payload,
      signature
    }
  ]
}, null, 2));

console.log('\n--- AES KEY (to store in user.privateKey.key for testing) ---');
console.log(aesKeyBase64);

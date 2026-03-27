const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createUserAndTest() {
  try {
    // 1. Create a user
    const user = await prisma.user.upsert({
      where: { id: '1' },
      update: {},
      create: {
        id: '1',
        password: 'dummy-hash',
        phone: '1234567890'
      }
    });
    
    console.log('User created:', user.id);

    // 1b. Create the device
    await prisma.device.upsert({
      where: { id: '1' },
      update: {},
      create: {
        id: '1',
        userId: '1',
        publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAK1AdzgOZ+6tWEyuY0CDOU3B1538nagQIOMKf8UlrggI=\n-----END PUBLIC KEY-----\n'
      }
    });
    
    // 2. Run the flow with a new transaction ID
    const encryptRes = await fetch('http://localhost:3000/crypto/simulate-encryption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: '1',
        transactionData: {
          transactionId: require('crypto').randomUUID(),
          amount: 150.5,
          currency: 'USD',
          recipientId: 'user-456'
        }
      })
    });
    
    const encryptData = await encryptRes.json();
    const syncPayload = encryptData.data.syncPayload;

    const syncRes = await fetch('http://localhost:3000/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload)
    });
    
    console.log('✅ simulate-encryption succeeded');
    console.log('Sync status:', syncRes.status);
    console.log('Sync response:', JSON.stringify(await syncRes.json(), null, 2));
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

createUserAndTest();

import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceResponseDto {
  @ApiProperty({ example: 'Device registered successfully' })
  message: string;

  @ApiProperty({ example: 'device-abc', description: 'Unique device identifier' })
  deviceId: string;

  @ApiProperty({
    example: '-----BEGIN PUBLIC KEY-----\n...',
    description: 'Generated Ed25519 public key (PEM format)',
  })
  publicKeyPem: string;

  @ApiProperty({
    example: '-----BEGIN PRIVATE KEY-----\n...',
    description: 'Generated Ed25519 private key (PEM format). STORE SECURELY!',
  })
  privateKeyPem: string;

  @ApiProperty({
    example: 'BASE64_AES_KEY',
    description: 'Generated AES-256 symmetric key (base64)',
  })
  aesKeyBase64: string;
}

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { CryptoService } from './crypto.service';
import { SimulateEncryptionDto } from './dto/simulate-encryption.dto';

@ApiTags('Crypto')
@Controller('crypto')
export class CryptoController {
  private readonly logger = new Logger(CryptoController.name);

  constructor(private readonly cryptoService: CryptoService) {}

  /**
   * POST /crypto/simulate-encryption
   *
   * Refactored to use CryptoService and dynamic key generation.
   * Hardcoded test secrets have been removed for production readiness.
   */
  @Post('simulate-encryption')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate the client-side encryption process',
    description: `
Generates a fully signed & encrypted transaction payload, exactly as a real
client device would produce before calling \`POST /sync\`.

**Note:** In production environments, this endpoint should be used with caution as it 
performs cryptographic operations that are normally client-side.
`,
  })
  @ApiBody({ type: SimulateEncryptionDto })
  @ApiResponse({
    status: 200,
    description: 'Simulated encrypted payload ready for POST /sync',
  })
  simulateEncryption(@Body() dto: SimulateEncryptionDto) {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(`Simulation endpoint called in PRODUCTION mode by device: ${dto.deviceId}`);
    }

    return this.cryptoService.simulateClientEncryption(dto);
  }
}

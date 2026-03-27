import { Test, TestingModule } from '@nestjs/testing';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

describe('SyncController', () => {
  let controller: SyncController;
  let syncService: jest.Mocked<SyncService>;

  beforeEach(async () => {
    const syncServiceMock: Partial<jest.Mocked<SyncService>> = {
      processSync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: syncServiceMock }],
    }).compile();

    controller = module.get<SyncController>(SyncController);
    syncService = module.get(SyncService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('syncTransactions()', () => {
    const dto = {
      deviceId: 'device-1',
      transactions: [
        {
          transactionId: 'tx-1',
          timestamp: Date.now(),
          nonce: 'nonce-abc',
          payload: { iv: 'aaa', content: 'bbb', tag: 'ccc' },
          signature: 'sig==',
        },
      ],
    };

    it('should call syncService.processSync with the incoming DTO', async () => {
      const mockResults = [{ status: 'success', nonce: 'nonce-abc' }];
      syncService.processSync.mockResolvedValueOnce(mockResults as any);

      await controller.syncTransactions(dto);

      expect(syncService.processSync).toHaveBeenCalledTimes(1);
      expect(syncService.processSync).toHaveBeenCalledWith(dto);
    });

    it('should wrap service results in { message, results }', async () => {
      const mockResults = [{ status: 'success', nonce: 'nonce-abc' }];
      syncService.processSync.mockResolvedValueOnce(mockResults as any);

      const response = await controller.syncTransactions(dto);

      expect(response).toEqual({ message: 'Sync processed', results: mockResults });
    });

    it('should propagate exceptions thrown by the service', async () => {
      syncService.processSync.mockRejectedValueOnce(new Error('unexpected'));

      await expect(controller.syncTransactions(dto)).rejects.toThrow('unexpected');
    });
  });
});

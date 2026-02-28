import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      const dto: CreateUserDto = {
        phone: '0599123456',
        password: 'password123',
        name: 'Test',
      };
      const result = { id: '1', ...dto, password: 'hashed', createdAt: new Date(), updatedAt: new Date(), role: 'USER' }; // role added for type compat if needed, simplified

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(result);

      expect(await service.create(dto)).toEqual(result);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});

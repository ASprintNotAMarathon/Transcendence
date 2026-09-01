import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// A URL that parses but is never dialled. Constructing PrismaService only
// builds the adapter; nothing opens a socket until $connect or a query, both
// of which are stubbed below. So these tests need no database.
const DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/db?schema=public';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: ConfigService, useValue: { get: () => DATABASE_URL } },
      ],
    }).compile();

    service = moduleRef.get(PrismaService);
  });

  it('is injectable', () => {
    expect(service).toBeDefined();
  });

  it('exposes the models in schema.prisma', () => {
    // Fails if the client was never generated, or if User left the schema.
    expect(service.user).toBeDefined();
  });

  it('connects on init and disconnects on destroy', async () => {
    const connect = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { BooksService } from './books.service.js';

describe('BooksService', () => {
  let service: BooksService;
  const prisma = { book: { findMany: vi.fn() } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('combines search, genre filters, and pagination', async () => {
    prisma.book.findMany.mockResolvedValue([]);

    await service.findAll({
      search: '  Dune ',
      genreId: 3,
      page: 3,
      limit: 5,
    });

    expect(prisma.book.findMany).toHaveBeenCalledWith({
      where: {
        genreId: 3,
        OR: [
          { title: { contains: 'Dune', mode: 'insensitive' } },
          { author: { contains: 'Dune', mode: 'insensitive' } },
          { isbn: { contains: 'Dune', mode: 'insensitive' } },
        ],
      },
      skip: 10,
      take: 5,
      include: { genre: true },
      orderBy: { id: 'asc' },
    });
  });

  it('uses the first page and default page size when pagination is omitted', async () => {
    prisma.book.findMany.mockResolvedValue([]);

    await service.findAll({});

    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });
});

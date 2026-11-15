import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const createdUser = {
    id: 1,
    name: 'Reader',
    email: 'reader@example.com',
    role: UserRole.MEMBER,
    createdAt: new Date(),
  };
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    book: {
      findMany: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);
    prisma.book.findMany.mockResolvedValue([]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('requires authentication for book management', () => {
    return request(app.getHttpServer())
      .post('/books')
      .send({
        title: 'Dune',
        author: 'Frank Herbert',
        isbn: '9780441172719',
        totalCopies: 1,
        genreId: 1,
      })
      .expect(401);
  });

  it('accepts validated book filters and pagination from the query string', async () => {
    await request(app.getHttpServer())
      .get('/books')
      .query({ genreId: 3, search: 'Dune', page: 2, limit: 5 })
      .expect(200)
      .expect([]);

    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          genreId: 3,
          OR: [
            { title: { contains: 'Dune', mode: 'insensitive' } },
            { author: { contains: 'Dune', mode: 'insensitive' } },
            { isbn: { contains: 'Dune', mode: 'insensitive' } },
          ],
        },
        skip: 5,
        take: 5,
      }),
    );
  });

  it('allows cross-origin requests', () => {
    return request(app.getHttpServer())
      .options('/books')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
      .expect('Access-Control-Allow-Origin', '*');
  });

  it('rejects members from book management routes', async () => {
    const token = await app.get(JwtService).signAsync({
      sub: 1,
      email: 'member@example.com',
      role: UserRole.MEMBER,
    });

    return request(app.getHttpServer())
      .post('/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Dune',
        author: 'Frank Herbert',
        isbn: '9780441172719',
        totalCopies: 1,
        genreId: 1,
      })
      .expect(403);
  });

  it('rejects invalid registration fields', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'R',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);
  });

  it('does not allow registration to create a librarian account', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Reader',
        email: createdUser.email,
        password: 'a-secure-password',
        role: UserRole.LIBRARIAN,
      })
      .expect(201);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.MEMBER }),
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });
});

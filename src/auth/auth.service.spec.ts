import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const jwt = { signAsync: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers new accounts as members and returns a JWT', async () => {
    const user = {
      id: 1,
      name: 'Reader',
      email: 'reader@example.com',
      role: UserRole.MEMBER,
      createdAt: new Date(),
    };
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    jwt.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.register({
        name: user.name,
        email: user.email,
        password: 'a-secure-password',
      }),
    ).resolves.toEqual({ access_token: 'signed-token', user });
    expect(prisma.user.create.mock.calls[0][0].data.role).toBe(UserRole.MEMBER);
    expect(prisma.user.create.mock.calls[0][0].data.password).not.toBe(
      'a-secure-password',
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: UserRole.MEMBER,
    });
  });

  it('authenticates with the stored password hash without returning it', async () => {
    const password = 'a-secure-password';
    const user = {
      id: 2,
      name: 'Reader',
      email: 'reader@example.com',
      password: await bcrypt.hash(password, 4),
      role: UserRole.MEMBER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.user.findUnique.mockResolvedValue(user);
    jwt.signAsync.mockResolvedValue('signed-token');

    const result = await service.login({ email: user.email, password });

    expect(result.access_token).toBe('signed-token');
    expect(result.user).not.toHaveProperty('password');
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: UserRole.MEMBER,
    });
  });

  it('rejects unknown login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'bad-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

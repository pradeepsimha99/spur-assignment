import 'dotenv/config';
import { vi } from 'vitest';

// Mock Prisma client globally
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  };

  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

// Mock Redis/ioredis globally
vi.mock('ioredis', () => {
  const mockRedis = {
    on: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    connect: vi.fn(),
    quit: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    scan: vi.fn(),
    info: vi.fn(),
    status: 'ready',
  };

  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  const mockCreate = vi.fn();

  const mockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  return {
    default: mockOpenAI,
  };
});

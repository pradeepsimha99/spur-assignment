import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import chatRouter from './chat';

// Mock all external services
vi.mock('../services/conversation', () => ({
  getOrCreateConversation: vi.fn(),
  saveUserMessage: vi.fn(),
  saveAiMessage: vi.fn(),
  getConversationHistory: vi.fn(),
}));

vi.mock('../services/llm', () => ({
  generateReply: vi.fn(),
  generateReplyStream: vi.fn(),
}));

vi.mock('../services/idempotency', () => ({
  getIdempotencyResult: vi.fn(),
  setIdempotencyResult: vi.fn(),
}));

// Import the mocked functions
import {
  getOrCreateConversation,
  saveUserMessage,
  saveAiMessage,
  getConversationHistory,
} from '../services/conversation';

import { generateReply } from '../services/llm';
import { getIdempotencyResult, setIdempotencyResult } from '../services/idempotency';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatRouter);
  return app;
}

describe('POST /chat/message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIdempotencyResult).mockResolvedValue(null);
  });

  it('should return 200 with reply and sessionId', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    const mockSaveUser = vi.mocked(saveUserMessage);
    const mockHistory = vi.mocked(getConversationHistory);
    const mockGenerate = vi.mocked(generateReply);
    const mockSaveAi = vi.mocked(saveAiMessage);

    mockGetOrCreate.mockResolvedValue({
      id: 'conv-1',
      createdAt: new Date(),
      messages: [],
    });
    mockSaveUser.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      sender: 'user',
      text: 'Hello',
      timestamp: new Date(),
    });
    mockHistory.mockResolvedValue([
      { sender: 'user', text: 'Hello' },
    ]);
    mockGenerate.mockResolvedValue('Hi there! How can I help you?');
    mockSaveAi.mockResolvedValue({
      id: 'msg-2',
      conversationId: 'conv-1',
      sender: 'ai',
      text: 'Hi there! How can I help you?',
      timestamp: new Date(),
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hello' })
      .expect(200);

    expect(res.body).toHaveProperty('reply');
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.reply).toBe('Hi there! How can I help you?');
    expect(res.body.sessionId).toBe('conv-1');
  });

  it('should return 400 for empty message', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: '' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for missing message field', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({})
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 for message that is too long', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'A'.repeat(2500) })
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('should handle LLM errors gracefully and still return 200', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    const mockSaveUser = vi.mocked(saveUserMessage);
    const mockHistory = vi.mocked(getConversationHistory);
    const mockGenerate = vi.mocked(generateReply);
    const mockSaveAi = vi.mocked(saveAiMessage);

    mockGetOrCreate.mockResolvedValue({
      id: 'conv-2',
      createdAt: new Date(),
      messages: [],
    });
    mockSaveUser.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-2',
      sender: 'user',
      text: 'Hello',
      timestamp: new Date(),
    });
    mockHistory.mockResolvedValue([{ sender: 'user', text: 'Hello' }]);
    mockGenerate.mockRejectedValue(new Error('API rate limit exceeded'));
    mockSaveAi.mockResolvedValue({
      id: 'msg-2',
      conversationId: 'conv-2',
      sender: 'ai',
      text: "I'm sorry, but I encountered an error: API rate limit exceeded",
      timestamp: new Date(),
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hello' })
      .expect(200);

    // Should still return 200 with a friendly error message
    expect(res.body.reply).toContain('error');
    expect(res.body.reply).toContain('API rate limit exceeded');
  });

  it('should handle internal service errors with 500', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    mockGetOrCreate.mockRejectedValue(new Error('Database connection failed'));

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hello' })
      .expect(500);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Internal server error');
  });

  it('should accept sessionId and use existing conversation', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    const mockSaveUser = vi.mocked(saveUserMessage);
    const mockHistory = vi.mocked(getConversationHistory);
    const mockGenerate = vi.mocked(generateReply);
    const mockSaveAi = vi.mocked(saveAiMessage);

    mockGetOrCreate.mockResolvedValue({
      id: 'existing-session',
      createdAt: new Date(),
      messages: [{ id: 'm1', conversationId: 'existing-session', sender: 'user', text: 'Previous message', timestamp: new Date() }],
    });
    mockSaveUser.mockResolvedValue({
      id: 'msg-2', conversationId: 'existing-session', sender: 'user', text: 'Hello again', timestamp: new Date(),
    });
    mockHistory.mockResolvedValue([{ sender: 'user', text: 'Previous message' }, { sender: 'user', text: 'Hello again' }]);
    mockGenerate.mockResolvedValue('Welcome back!');
    mockSaveAi.mockResolvedValue({
      id: 'msg-3', conversationId: 'existing-session', sender: 'ai', text: 'Welcome back!', timestamp: new Date(),
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hello again', sessionId: 'existing-session' })
      .expect(200);

    expect(res.body.sessionId).toBe('existing-session');
    expect(mockGetOrCreate).toHaveBeenCalledWith('existing-session');
  });

  it('should return cached response when idempotencyKey matches', async () => {
    vi.mocked(getIdempotencyResult).mockResolvedValue({
      reply: 'Cached reply',
      sessionId: 'cached-session',
    });

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hello', idempotencyKey: 'dup-key-123' })
      .expect(200);

    expect(res.body.reply).toBe('Cached reply');
    expect(res.body.sessionId).toBe('cached-session');
    expect(res.body.idempotencyKey).toBe('dup-key-123');
    // Should NOT have called the LLM or DB
    expect(vi.mocked(getOrCreateConversation)).not.toHaveBeenCalled();
    expect(vi.mocked(generateReply)).not.toHaveBeenCalled();
  });

  it('should store idempotency result for new requests with key', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    const mockSaveUser = vi.mocked(saveUserMessage);
    const mockHistory = vi.mocked(getConversationHistory);
    const mockGenerate = vi.mocked(generateReply);
    const mockSaveAi = vi.mocked(saveAiMessage);

    mockGetOrCreate.mockResolvedValue({ id: 'idemp-conv', createdAt: new Date(), messages: [] });
    mockSaveUser.mockResolvedValue({ id: 'm1', conversationId: 'idemp-conv', sender: 'user', text: 'Hi', timestamp: new Date() });
    mockHistory.mockResolvedValue([{ sender: 'user', text: 'Hi' }]);
    mockGenerate.mockResolvedValue('Hello!');
    mockSaveAi.mockResolvedValue({ id: 'm2', conversationId: 'idemp-conv', sender: 'ai', text: 'Hello!', timestamp: new Date() });

    const app = createApp();
    const res = await request(app)
      .post('/chat/message')
      .send({ message: 'Hi', idempotencyKey: 'fresh-key' })
      .expect(200);

    expect(vi.mocked(setIdempotencyResult)).toHaveBeenCalledWith('fresh-key', {
      reply: 'Hello!',
      sessionId: 'idemp-conv',
    });
    expect(res.body.idempotencyKey).toBe('fresh-key');
  });
});

describe('GET /chat/:sessionId/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return messages for a valid session', async () => {
    const mockGetOrCreate = vi.mocked(getOrCreateConversation);
    mockGetOrCreate.mockResolvedValue({
      id: 'conv-1',
      createdAt: new Date(),
      messages: [
        { id: 'm1', conversationId: 'conv-1', sender: 'user', text: 'Hello', timestamp: new Date() },
        { id: 'm2', conversationId: 'conv-1', sender: 'ai', text: 'Hi!', timestamp: new Date() },
      ],
    });

    const app = createApp();
    const res = await request(app)
      .get('/chat/conv-1/messages')
      .expect(200);

    expect(res.body.sessionId).toBe('conv-1');
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].text).toBe('Hello');
  });

  it('should return 400 for whitespace-only sessionId', async () => {
    const app = createApp();
    // URL encoding: /chat/%20%20/messages -> sessionId = '  '
    const res = await request(app)
      .get('/chat/%20%20/messages')
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });

  it('should return 404 for unmatched route (double slash)', async () => {
    const app = createApp();
    await request(app)
      .get('/chat//messages')
      .expect(404);
  });
});

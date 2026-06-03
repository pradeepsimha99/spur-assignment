import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, fetchMessages, listConversations } from './api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a message and return the response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 'Hello!', sessionId: 'sess-1' }),
    });

    const result = await sendMessage('Hello', undefined, 'test-idemp-1');

    expect(result.reply).toBe('Hello!');
    expect(result.sessionId).toBe('sess-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/message',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', sessionId: undefined, idempotencyKey: 'test-idemp-1' }),
      })
    );
  });

  it('should send message with sessionId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 'Welcome back!', sessionId: 'sess-1' }),
    });

    await sendMessage('Hello again', 'sess-1', 'test-idemp-2');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat/message',
      expect.objectContaining({
        body: JSON.stringify({ message: 'Hello again', sessionId: 'sess-1', idempotencyKey: 'test-idemp-2' }),
      })
    );
  });

  it('should generate idempotencyKey when not provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 'Hi!', sessionId: 'sess-2' }),
    });

    await sendMessage('Hello');

    // Should have been called with some idempotencyKey
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.idempotencyKey).toBeDefined();
    expect(typeof callBody.idempotencyKey).toBe('string');
    expect(callBody.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('should throw an error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'message cannot be empty' }),
    });

    await expect(sendMessage('', undefined, 'test-idemp-3')).rejects.toThrow('message cannot be empty');
  });

  it('should throw a generic error when response body cannot be parsed', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(sendMessage('Hello', undefined, 'test-idemp-4')).rejects.toThrow('Request failed with status 500');
  });
});

describe('fetchMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages for a session', async () => {
    const messages = [
      { id: '1', sender: 'user', text: 'Hi', timestamp: new Date().toISOString() },
      { id: '2', sender: 'ai', text: 'Hello!', timestamp: new Date().toISOString() },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess-1', messages }),
    });

    const result = await fetchMessages('sess-1');

    expect(result.sessionId).toBe('sess-1');
    expect(result.messages).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/sess-1/messages');
  });

  it('should encode the sessionId in the URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess/1', messages: [] }),
    });

    await fetchMessages('sess/1');

    expect(mockFetch).toHaveBeenCalledWith('/api/chat/sess%2F1/messages');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    await expect(fetchMessages('bad-id')).rejects.toThrow('Server error');
  });
});

describe('listConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return conversations', async () => {
    const conversations = [
      { id: 'conv-1', createdAt: '2026-01-01T00:00:00Z', lastMessageAt: '2026-01-02T00:00:00Z', preview: 'Hello!', messageCount: 5 },
      { id: 'conv-2', createdAt: '2026-01-03T00:00:00Z', lastMessageAt: '2026-01-04T00:00:00Z', preview: 'Hi there!', messageCount: 3 },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ conversations }),
    });

    const result = await listConversations();

    expect(result.conversations).toHaveLength(2);
    expect(result.conversations[0].id).toBe('conv-1');
    expect(result.conversations[1].preview).toBe('Hi there!');
    expect(mockFetch).toHaveBeenCalledWith('/api/chat/conversations');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    await expect(listConversations()).rejects.toThrow('Server error');
  });
});

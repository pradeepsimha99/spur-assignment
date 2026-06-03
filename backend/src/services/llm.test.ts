import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReply, getLLMConfig } from './llm';

// Mock OpenAI module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  const mockOpenAI = vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  return { default: mockOpenAI };
});

describe('getLLMConfig', () => {
  it('should return default values when env vars are not set', () => {
    // GROQ_API_KEY is typically not set in test env
    const config = getLLMConfig();
    expect(config.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(config.model).toBe('llama-3.3-70b-versatile');
    expect(config.maxTokens).toBe(500);
    expect(config.maxMessages).toBe(20);
    expect(config.temperature).toBe(0.7);
  });
});

describe('generateReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env var for tests
    process.env.GROQ_API_KEY = 'test-key';
  });

  it('should throw if GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    await expect(generateReply([], 'Hello')).rejects.toThrow('API key');
  });

  it('should return the reply from OpenAI/Groq', async () => {
    const { default: OpenAI } = await import('openai');
    const mockClient = (OpenAI as any)();
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: '  Hello! How can I help you today?  ' } }],
    });

    const reply = await generateReply([], 'Hi there');
    expect(reply).toBe('Hello! How can I help you today?');
  });

  it('should include conversation history in the prompt', async () => {
    const { default: OpenAI } = await import('openai');
    const mockClient = (OpenAI as any)();
    const mockCreate = mockClient.chat.completions.create;

    // The history should include the current user message (as it does in the real flow
    // where getConversationHistory is called AFTER saveUserMessage)
    const history = [
      { sender: 'user', text: 'What is your return policy?' },
      { sender: 'ai', text: 'Our return policy is 30 days.' },
      { sender: 'user', text: 'Thanks!' },
    ];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Anything else?' } }],
    });

    await generateReply(history, 'Thanks!');

    // Check that the system prompt, history, and user message were included
    const messagesArg = mockCreate.mock.calls[0][0].messages;
    expect(messagesArg.length).toBeGreaterThanOrEqual(4);
    expect(messagesArg[0].role).toBe('system');
    expect(messagesArg.some((m: any) => m.content.includes('return policy'))).toBe(true);
    expect(messagesArg.some((m: any) => m.content === 'Thanks!')).toBe(true);
  });

  it('should handle LLM API errors gracefully', async () => {
    const { default: OpenAI } = await import('openai');
    const mockClient = (OpenAI as any)();
    mockClient.chat.completions.create.mockRejectedValue({
      status: 429,
      message: 'Rate limit exceeded',
    });

    await expect(generateReply([], 'Hello')).rejects.toThrow('Rate limit exceeded');
  });

  it('should handle timeout errors', async () => {
    const { default: OpenAI } = await import('openai');
    const mockClient = (OpenAI as any)();
    mockClient.chat.completions.create.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'Connection timed out',
    });

    await expect(generateReply([], 'Hello')).rejects.toThrow('too long');
  });

  it('should handle 401 unauthorized errors', async () => {
    const { default: OpenAI } = await import('openai');
    const mockClient = (OpenAI as any)();
    mockClient.chat.completions.create.mockRejectedValue({
      status: 401,
      message: 'Invalid API key',
    });

    await expect(generateReply([], 'Hello')).rejects.toThrow('Invalid API key');
  });
});

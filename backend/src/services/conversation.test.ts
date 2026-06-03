import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock prisma before importing the service
// The mock is set up in test-setup.ts, but we need to access the mock instance
const mockPrismaInstance = {
  conversation: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  message: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaInstance),
}));

// Import after mocks
const { getOrCreateConversation, saveUserMessage, saveAiMessage, getConversationHistory } = await import('./conversation');

describe('Conversation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateConversation', () => {
    it('should return existing conversation if sessionId is provided and found', async () => {
      const existingConvo = {
        id: 'existing-id',
        createdAt: new Date(),
        messages: [
          { id: 'msg-1', conversationId: 'existing-id', sender: 'user', text: 'Hello', timestamp: new Date() },
        ],
      };

      mockPrismaInstance.conversation.findUnique.mockResolvedValue(existingConvo);

      const result = await getOrCreateConversation('existing-id');

      expect(result.id).toBe('existing-id');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].text).toBe('Hello');
      expect(mockPrismaInstance.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        include: { messages: { orderBy: { timestamp: 'asc' } } },
      });
    });

    it('should create a new conversation if sessionId is not provided', async () => {
      const newConvo = {
        id: 'new-id',
        createdAt: new Date(),
        messages: [],
      };

      mockPrismaInstance.conversation.create.mockResolvedValue(newConvo);

      const result = await getOrCreateConversation();

      expect(result.id).toBe('new-id');
      expect(result.messages).toHaveLength(0);
      expect(mockPrismaInstance.conversation.create).toHaveBeenCalled();
    });

    it('should create a new conversation if sessionId is not found', async () => {
      mockPrismaInstance.conversation.findUnique.mockResolvedValue(null);

      const newConvo = {
        id: 'new-id-2',
        createdAt: new Date(),
        messages: [],
      };
      mockPrismaInstance.conversation.create.mockResolvedValue(newConvo);

      const result = await getOrCreateConversation('nonexistent-id');

      expect(result.id).toBe('new-id-2');
      expect(mockPrismaInstance.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
        include: { messages: { orderBy: { timestamp: 'asc' } } },
      });
      expect(mockPrismaInstance.conversation.create).toHaveBeenCalled();
    });
  });

  describe('saveUserMessage', () => {
    it('should save a user message and return it', async () => {
      const savedMsg = {
        id: 'msg-1',
        conversationId: 'conv-1',
        sender: 'user',
        text: 'Hello!',
        timestamp: new Date(),
      };

      mockPrismaInstance.message.create.mockResolvedValue(savedMsg);

      const result = await saveUserMessage('conv-1', 'Hello!');

      expect(result.id).toBe('msg-1');
      expect(result.sender).toBe('user');
      expect(result.text).toBe('Hello!');
      expect(mockPrismaInstance.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', sender: 'user', text: 'Hello!' },
      });
    });
  });

  describe('saveAiMessage', () => {
    it('should save an AI message and return it', async () => {
      const savedMsg = {
        id: 'msg-2',
        conversationId: 'conv-1',
        sender: 'ai',
        text: 'How can I help?',
        timestamp: new Date(),
      };

      mockPrismaInstance.message.create.mockResolvedValue(savedMsg);

      const result = await saveAiMessage('conv-1', 'How can I help?');

      expect(result.id).toBe('msg-2');
      expect(result.sender).toBe('ai');
      expect(result.text).toBe('How can I help?');
    });
  });

  describe('getConversationHistory', () => {
    it('should return sender/text pairs ordered by timestamp', async () => {
      const messages = [
        { sender: 'user', text: 'Hello' },
        { sender: 'ai', text: 'Hi there!' },
      ];

      mockPrismaInstance.message.findMany.mockResolvedValue(messages);

      const result = await getConversationHistory('conv-1');

      expect(result).toHaveLength(2);
      expect(result[0].sender).toBe('user');
      expect(result[1].text).toBe('Hi there!');
      expect(mockPrismaInstance.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { timestamp: 'asc' },
        select: { sender: true, text: true },
      });
    });

    it('should return empty array for conversation with no messages', async () => {
      mockPrismaInstance.message.findMany.mockResolvedValue([]);

      const result = await getConversationHistory('empty-conv');

      expect(result).toHaveLength(0);
    });
  });
});

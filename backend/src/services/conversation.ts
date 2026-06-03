import { PrismaClient } from '@prisma/client';
import { Conversation, ConversationMessage } from '../models/types';
import { cacheGetObject, cacheSetObject, cacheDelete, conversationKey, historyKey, getCacheTTL } from '../cache/redis';

const prisma = new PrismaClient();

/**
 * Get or create a conversation by session ID.
 * Returns the conversation with its messages.
 * Results are cached in Redis when available.
 */
export async function getOrCreateConversation(sessionId?: string): Promise<Conversation> {
  if (sessionId) {
    // Try cache first
    const cacheKey = conversationKey(sessionId);
    const cached = await cacheGetObject<Conversation>(cacheKey);
    if (cached) {
      return cached;
    }

    const existing = await prisma.conversation.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (existing) {
      const conversation: Conversation = {
        id: existing.id,
        createdAt: existing.createdAt,
        messages: existing.messages.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          sender: m.sender as 'user' | 'ai',
          text: m.text,
          timestamp: m.timestamp,
        })),
      };

      // Cache the conversation
      await cacheSetObject(cacheKey, conversation, getCacheTTL('conversation'));
      return conversation;
    }
  }

  // Create a new conversation
  const newConversation = await prisma.conversation.create({
    data: {},
    include: {
      messages: {
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  const conversation: Conversation = {
    id: newConversation.id,
    createdAt: newConversation.createdAt,
    messages: [],
  };

  // Cache the new conversation
  await cacheSetObject(conversationKey(conversation.id), conversation, getCacheTTL('conversation'));

  return conversation;
}

/**
 * Save a user message to the database.
 * Invalidates the conversation cache after saving.
 */
export async function saveUserMessage(
  conversationId: string,
  text: string
): Promise<ConversationMessage> {
  const message = await prisma.message.create({
    data: {
      conversationId,
      sender: 'user',
      text,
    },
  });

  // Invalidate conversation and history cache
  await Promise.all([
    cacheDelete(conversationKey(conversationId)),
    cacheDelete(historyKey(conversationId)),
  ]);

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: 'user',
    text: message.text,
    timestamp: message.timestamp,
  };
}

/**
 * Save an AI reply message to the database.
 * Invalidates the conversation and history cache after saving.
 */
export async function saveAiMessage(
  conversationId: string,
  text: string
): Promise<ConversationMessage> {
  const message = await prisma.message.create({
    data: {
      conversationId,
      sender: 'ai',
      text,
    },
  });

  // Invalidate conversation and history cache
  await Promise.all([
    cacheDelete(conversationKey(conversationId)),
    cacheDelete(historyKey(conversationId)),
  ]);

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: 'ai',
    text: message.text,
    timestamp: message.timestamp,
  };
}

/**
 * Get conversation history for context (without full message objects, just sender/text pairs).
 * Results are cached in Redis when available.
 */
export async function getConversationHistory(
  conversationId: string
): Promise<{ sender: string; text: string }[]> {
  // Try cache first
  const cacheKey = historyKey(conversationId);
  const cached = await cacheGetObject<{ sender: string; text: string }[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { timestamp: 'asc' },
    select: { sender: true, text: true },
  });

  // Cache the history (short TTL since it changes frequently)
  await cacheSetObject(cacheKey, messages, getCacheTTL('history'));

  return messages;
}

/**
 * List all conversations with summary info (preview, message count, timestamps).
 * Ordered by most recently updated first.
 */
export async function listConversations(limit: number = 50): Promise<{
  id: string;
  createdAt: Date;
  lastMessageAt: Date;
  preview: string;
  messageCount: number;
}[]> {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 100),
    include: {
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1, // Just the last message for preview
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  return conversations.map((c) => ({
    id: c.id,
    createdAt: c.createdAt,
    lastMessageAt: c.messages[0]?.timestamp ?? c.createdAt,
    preview: c.messages[0]?.text?.slice(0, 120) ?? '(empty conversation)',
    messageCount: c._count.messages,
  }));
}

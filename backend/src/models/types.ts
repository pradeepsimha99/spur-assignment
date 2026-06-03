export interface ChatRequest {
  message: string;
  sessionId?: string;
  idempotencyKey?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  idempotencyKey?: string;
}

export interface ConversationSummary {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  preview: string;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  createdAt: Date;
  messages: ConversationMessage[];
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  maxMessages: number;
  temperature: number;
}

export interface AppError {
  status: number;
  message: string;
  code: string;
}

export interface CacheHealth {
  connected: boolean;
  stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
  };
  info?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  prefix: string;
}

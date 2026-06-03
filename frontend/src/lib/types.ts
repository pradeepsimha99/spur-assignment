export interface Message {
	id: string;
	sender: 'user' | 'ai';
	text: string;
	timestamp: Date;
}

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

export interface MessagesResponse {
	sessionId: string;
	messages: Message[];
}

export interface StreamEvent {
	type: 'token' | 'done' | 'error';
	text?: string;
	sessionId?: string;
	reply?: string;
	message?: string;
	idempotencyKey?: string;
}

export type ChatStatus = 'idle' | 'sending' | 'streaming' | 'error';

export interface ConversationSummary {
	id: string;
	createdAt: string;
	lastMessageAt: string;
	preview: string;
	messageCount: number;
}

export interface ConversationsResponse {
	conversations: ConversationSummary[];
}

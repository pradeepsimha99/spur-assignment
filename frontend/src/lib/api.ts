import type { ChatResponse, MessagesResponse, StreamEvent, ConversationsResponse } from './types';

// Read the API base URL from env, or default to the Vite proxy path
// Strip trailing slashes to prevent double-slash in constructed URLs (e.g. "https://...//chat/message")
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

/**
 * Generate a unique idempotency key for each message.
 */
function generateIdempotencyKey(): string {
	return crypto.randomUUID();
}

/**
 * Send a chat message to the backend with idempotency support.
 */
export async function sendMessage(
	message: string,
	sessionId?: string,
	idempotencyKey?: string
): Promise<ChatResponse> {
	const key = idempotencyKey || generateIdempotencyKey();
	const response = await fetch(`${API_BASE}/chat/message`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message, sessionId, idempotencyKey: key })
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => null);
		throw new Error(
			errorData?.message || `Request failed with status ${response.status}`
		);
	}

	return response.json();
}

/**
 * Send a chat message and stream the response via SSE (with idempotency support).
 * Calls onToken for each partial token, and resolves with the final reply and sessionId.
 */
export async function sendMessageStream(
	message: string,
	sessionId: string | undefined,
	onToken: (text: string) => void,
	onError: (error: string) => void,
	idempotencyKey?: string
): Promise<{ reply: string; sessionId: string }> {
	const key = idempotencyKey || generateIdempotencyKey();
	const response = await fetch(`${API_BASE}/chat/message/stream`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ message, sessionId, idempotencyKey: key })
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => null);
		throw new Error(
			errorData?.message || `Request failed with status ${response.status}`
		);
	}

	const reader = response.body!
		.pipeThrough(new TextDecoderStream())
		.getReader();

	let buffer = '';
	let accumulatedReply = '';
	let finalSessionId = sessionId || '';

	return new Promise((resolve, reject) => {
		async function read() {
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;

					buffer += value;
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed.startsWith('data: ')) continue;

						try {
							const event: StreamEvent = JSON.parse(trimmed.slice(6));

							switch (event.type) {
								case 'token':
									if (event.text) {
										accumulatedReply += event.text;
										onToken(accumulatedReply);
									}
									break;
								case 'done':
									finalSessionId = event.sessionId || finalSessionId;
									resolve({ reply: event.reply || accumulatedReply, sessionId: finalSessionId });
									return;
								case 'error':
									onError(event.message || 'An error occurred');
									resolve({ reply: event.reply || accumulatedReply || 'An error occurred', sessionId: finalSessionId });
									return;
							}
						} catch {
							// Skip malformed lines
						}
					}
				}

				// Stream ended without a 'done' event
				resolve({ reply: accumulatedReply, sessionId: finalSessionId });
			} catch (err) {
				reject(err);
			}
		}

		read();
	});
}

/**
 * Fetch messages for a given session.
 */
export async function fetchMessages(sessionId: string): Promise<MessagesResponse> {
	const response = await fetch(`${API_BASE}/chat/${encodeURIComponent(sessionId)}/messages`);

	if (!response.ok) {
		const errorData = await response.json().catch(() => null);
		throw new Error(
			errorData?.message || `Failed to fetch messages: ${response.status}`
		);
	}

	return response.json();
}

/**
 * List all conversations ordered by most recent first.
 */
export async function listConversations(): Promise<ConversationsResponse> {
	const response = await fetch(`${API_BASE}/chat/conversations`);

	if (!response.ok) {
		const errorData = await response.json().catch(() => null);
		throw new Error(
			errorData?.message || `Failed to list conversations: ${response.status}`
		);
	}

	return response.json();
}

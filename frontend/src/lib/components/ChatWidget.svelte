<script lang="ts">
	import { onMount } from 'svelte';
	import MessageList from './MessageList.svelte';
	import MessageInput from './MessageInput.svelte';
	import ConversationList from './ConversationList.svelte';
	import { sendMessage, sendMessageStream, fetchMessages, listConversations } from '$lib/api';
	import type { Message, ChatStatus, ConversationSummary } from '$lib/types';

	// Try to restore session from localStorage
	const STORAGE_KEY = 'spur-chat-session';

	let messages = $state<Message[]>([]);
	let sessionId = $state<string>('');
	let status = $state<ChatStatus>('idle');
	let errorMsg = $state<string>('');
	let streamedText = $state<string>('');
	let conversations = $state<ConversationSummary[]>([]);
	let conversationsLoading = $state<boolean>(false);
	let sidebarOpen = $state<boolean>(true);

	onMount(() => {
		// Restore session on load
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (parsed && parsed.sessionId) {
					sessionId = parsed.sessionId;
					loadHistory(parsed.sessionId);
				}
			} catch {
				localStorage.removeItem(STORAGE_KEY);
			}
		}

		// Load conversation list in background
		refreshConversations();
	});

	async function loadHistory(id: string) {
		try {
			const data = await fetchMessages(id);
			messages = data.messages.map((m) => ({
				...m,
				timestamp: new Date(m.timestamp)
			}));
		} catch {
			// If session expired or invalid, start fresh
			sessionId = '';
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	async function refreshConversations() {
		conversationsLoading = true;
		try {
			const data = await listConversations();
			conversations = data.conversations;
		} catch {
			// Silently fail — conversations are non-critical
		} finally {
			conversationsLoading = false;
		}
	}

	// Listen for suggestion chip clicks
	function handleSuggestMessage(e: Event) {
		const detail = (e as CustomEvent).detail;
		if (typeof detail === 'string') {
			handleSend(detail);
		}
	}

	onMount(() => {
		window.addEventListener('suggest-message', handleSuggestMessage);
		return () => window.removeEventListener('suggest-message', handleSuggestMessage);
	});

	function generateId(): string {
		return crypto.randomUUID();
	}

	async function handleSend(text: string) {
		// Optimistically add user message
		const userMsg: Message = {
			id: generateId(),
			sender: 'user',
			text,
			timestamp: new Date()
		};
		messages = [...messages, userMsg];
		status = 'sending';
		errorMsg = '';
		streamedText = '';

		// Create a placeholder AI message for streaming
		const aiMsgId = generateId();
		const aiMsg: Message = {
			id: aiMsgId,
			sender: 'ai',
			text: '',
			timestamp: new Date()
		};
		messages = [...messages, aiMsg];

		// Generate idempotency key for this message
		const idempotencyKey = crypto.randomUUID();

		try {
			// Try streaming first
			status = 'streaming';

			const result = await sendMessageStream(
				text,
				sessionId || undefined,
				(accumulated: string) => {
					streamedText = accumulated;
					messages = messages.map((m) =>
						m.id === aiMsgId ? { ...m, text: accumulated } : m
					);
				},
				(err: string) => {
					errorMsg = err;
				},
				idempotencyKey
			);

			// Update session
			sessionId = result.sessionId;
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));

			// Finalize the AI message with the full reply
			messages = messages.map((m) =>
				m.id === aiMsgId ? { ...m, text: result.reply, timestamp: new Date() } : m
			);
			streamedText = '';
			status = 'idle';

			// Refresh conversation list
			refreshConversations();
		} catch (err) {
			// If streaming fails, fall back to non-streaming
			try {
				status = 'sending';
				const response = await sendMessage(
					text,
					sessionId || undefined,
					idempotencyKey
				);

				sessionId = response.sessionId;
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));

				messages = messages.map((m) =>
					m.id === aiMsgId ? { ...m, text: response.reply, timestamp: new Date() } : m
				);
				streamedText = '';
				status = 'idle';

				// Refresh conversation list
				refreshConversations();
			} catch (fallbackErr) {
				status = 'error';
				const errorText = fallbackErr instanceof Error ? fallbackErr.message : 'Something went wrong. Please try again.';
				errorMsg = errorText;

				// Remove the placeholder AI message and the optimistically added user message
				messages = messages.filter((m) => m.id !== aiMsgId && m.id !== userMsg.id);

				// Add an error message in the chat
				const errorMsgEntry: Message = {
					id: generateId(),
					sender: 'ai',
					text: `❌ ${errorText}`,
					timestamp: new Date()
				};
				messages = [...messages, errorMsgEntry];
				streamedText = '';
			}
		}
	}

	function handleNewChat() {
		messages = [];
		sessionId = '';
		status = 'idle';
		errorMsg = '';
		streamedText = '';
		localStorage.removeItem(STORAGE_KEY);
	}

	async function handleSelectConversation(id: string) {
		if (id === sessionId) return; // Already viewing this conversation
		sessionId = id;
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));
		status = 'idle';
		errorMsg = '';
		streamedText = '';
		await loadHistory(id);
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<div class="app-layout">
	<div class="sidebar-wrapper" class:hidden={!sidebarOpen}>
		<ConversationList
			conversations={conversations}
			activeSessionId={sessionId}
			loading={conversationsLoading}
			onSelect={handleSelectConversation}
			onNewChat={handleNewChat}
		/>
	</div>

	<div class="chat-widget">
		<div class="chat-header">
			<div class="header-left">
				<button class="sidebar-toggle" onclick={toggleSidebar} title="Toggle conversations" aria-label="Toggle conversation list">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				</button>
				<div class="status-indicator" class:streaming={status === 'streaming'}></div>
				<div>
					<div class="header-title">Spur Support</div>
					<div class="header-subtitle">
						{#if sessionId}
							AI-powered support
						{:else}
							Start a new conversation
						{/if}
					</div>
				</div>
			</div>
			<button class="new-chat-btn" onclick={handleNewChat} title="Start new conversation" aria-label="Start new conversation">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="16"></line>
					<line x1="8" y1="12" x2="16" y2="12"></line>
				</svg>
			</button>
		</div>

		<MessageList {messages} isTyping={status === 'sending'} isStreaming={status === 'streaming'} {streamedText} />

		{#if errorMsg && status === 'error'}
			<div class="error-bar">
				<span>⚠️ {errorMsg}</span>
			</div>
		{/if}

		<MessageInput disabled={status === 'sending' || status === 'streaming'} onSend={handleSend} />
	</div>

	<!-- Mobile sidebar overlay -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="sidebar-overlay" onclick={toggleSidebar} onkeydown={(e) => e.key === 'Escape' && toggleSidebar()} role="presentation"></div>
	{/if}
</div>

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		background: white;
		position: relative;
	}

	.sidebar-wrapper {
		flex-shrink: 0;
		z-index: 20;
	}

	.sidebar-wrapper.hidden {
		display: none;
	}

	.chat-widget {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: white;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, #1e40af, #3b82f6);
		color: white;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 10;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.sidebar-toggle {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: white;
		width: 34px;
		height: 34px;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sidebar-toggle:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #22c55e;
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
		animation: pulse 2s infinite;
	}

	.status-indicator.streaming {
		background: #3b82f6;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.header-title {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: 0.01em;
	}

	.header-subtitle {
		font-size: 0.75rem;
		opacity: 0.85;
		margin-top: 0.1rem;
	}

	.new-chat-btn {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: white;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.new-chat-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: rotate(90deg);
	}

	.error-bar {
		background: #fef2f2;
		border-top: 1px solid #fecaca;
		padding: 0.5rem 1.25rem;
		font-size: 0.8rem;
		color: #dc2626;
	}

	.sidebar-overlay {
		display: none;
	}

	@media (max-width: 768px) {
		.sidebar-wrapper {
			position: fixed;
			left: 0;
			top: 0;
			height: 100vh;
			z-index: 30;
		}

		.sidebar-wrapper.hidden {
			display: none;
		}

		.sidebar-overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.3);
			z-index: 25;
		}

		.chat-header {
			position: relative;
			z-index: 15;
		}
	}
</style>

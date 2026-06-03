<script lang="ts">
	import { onMount } from 'svelte';
	import MessageList from './MessageList.svelte';
	import MessageInput from './MessageInput.svelte';
	import ConversationList from './ConversationList.svelte';
	import { sendMessage, sendMessageStream, fetchMessages, listConversations } from '$lib/api';
	import type { Message, ChatStatus, ConversationSummary } from '$lib/types';

	const STORAGE_KEY = 'spur-chat-session';
	const THEME_KEY = 'spur-chat-theme';

	let messages = $state<Message[]>([]);
	let sessionId = $state<string>('');
	let status = $state<ChatStatus>('idle');
	let errorMsg = $state<string>('');
	let streamedText = $state<string>('');
	let conversations = $state<ConversationSummary[]>([]);
	let conversationsLoading = $state<boolean>(false);
	let sidebarOpen = $state<boolean>(true);
	let isMobile = $state(false);
	let darkMode = $state(false);

	onMount(() => {
		isMobile = window.innerWidth <= 768;
		if (isMobile) sidebarOpen = false;

		// Initialize theme
		const savedTheme = localStorage.getItem(THEME_KEY);
		if (savedTheme === 'dark') {
			darkMode = true;
			document.documentElement.classList.add('dark');
		} else if (savedTheme === 'light') {
			darkMode = false;
			document.documentElement.classList.remove('dark');
		} else {
			// Respect system preference
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			darkMode = prefersDark;
			if (prefersDark) {
				document.documentElement.classList.add('dark');
			}
		}

		// Restore session
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

		refreshConversations();

		const handleResize = () => {
			isMobile = window.innerWidth <= 768;
			if (!isMobile) sidebarOpen = true;
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function toggleTheme() {
		darkMode = !darkMode;
		if (darkMode) {
			document.documentElement.classList.add('dark');
			localStorage.setItem(THEME_KEY, 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem(THEME_KEY, 'light');
		}
	}

	async function loadHistory(id: string) {
		try {
			const data = await fetchMessages(id);
			messages = data.messages.map((m) => ({
				...m,
				timestamp: new Date(m.timestamp)
			}));
		} catch {
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
			// Silently fail
		} finally {
			conversationsLoading = false;
		}
	}

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
		if (isMobile) sidebarOpen = false;

		const userMsg: Message = {
			id: generateId(),
			sender: 'user',
			text,
			timestamp: new Date()
		};

		const aiMsg: Message = {
			id: generateId(),
			sender: 'ai',
			text: '',
			timestamp: new Date()
		};

		messages = [...messages, userMsg, aiMsg];
		status = 'sending';
		errorMsg = '';
		streamedText = '';

		const idempotencyKey = crypto.randomUUID();

		try {
			status = 'streaming';

			const result = await sendMessageStream(
				text,
				sessionId || undefined,
				(accumulated: string) => {
					streamedText = accumulated;
					messages = messages.map((m) =>
						m.id === aiMsg.id ? { ...m, text: accumulated } : m
					);
				},
				(err: string) => {
					errorMsg = err;
				},
				idempotencyKey
			);

			sessionId = result.sessionId;
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));

			messages = messages.map((m) =>
				m.id === aiMsg.id ? { ...m, text: result.reply, timestamp: new Date() } : m
			);
			streamedText = '';
			status = 'idle';
			refreshConversations();
		} catch (err) {
			try {
				status = 'sending';
				const response = await sendMessage(text, sessionId || undefined, idempotencyKey);

				sessionId = response.sessionId;
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));

				messages = messages.map((m) =>
					m.id === aiMsg.id ? { ...m, text: response.reply, timestamp: new Date() } : m
				);
				streamedText = '';
				status = 'idle';
				refreshConversations();
			} catch (fallbackErr) {
				status = 'error';
				const errorText = fallbackErr instanceof Error ? fallbackErr.message : 'Something went wrong. Please try again.';
				errorMsg = errorText;

				messages = messages.filter((m) => m.id !== aiMsg.id && m.id !== userMsg.id);

				const errorMsgEntry: Message = {
					id: generateId(),
					sender: 'ai',
					text: '\u274C ' + errorText,
					timestamp: new Date()
				};
				messages = [...messages, userMsg, errorMsgEntry];
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
		if (isMobile) sidebarOpen = false;
	}

	async function handleSelectConversation(id: string) {
		if (id === sessionId) return;
		sessionId = id;
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }));
		status = 'idle';
		errorMsg = '';
		streamedText = '';
		await loadHistory(id);
		if (isMobile) sidebarOpen = false;
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<div class="app-layout">
	<div class="sidebar-wrapper" class:visible={sidebarOpen} class:hidden={!sidebarOpen}>
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
				<button class="icon-btn" onclick={toggleSidebar} title="Toggle conversations" aria-label="Toggle conversation list">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="3" y1="6" x2="21" y2="6" />
						<line x1="3" y1="12" x2="21" y2="12" />
						<line x1="3" y1="18" x2="21" y2="18" />
					</svg>
				</button>
				<div class="header-info">
					<div class="header-title">Spur Support</div>
					<div class="header-subtitle">
						{#if status === 'streaming'}
							<span class="streaming-label">AI is typing...</span>
						{:else if sessionId}
							AI-powered customer support
						{:else}
							Start a new conversation
						{/if}
					</div>
				</div>
			</div>
			<div class="header-right">
				<button class="icon-btn" onclick={toggleTheme} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">
					{#if darkMode}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="5" />
							<line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
							<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
							<line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
							<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
						</svg>
					{:else}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
						</svg>
					{/if}
				</button>
				<button class="icon-btn new-chat-btn" onclick={handleNewChat} title="Start new conversation" aria-label="Start new conversation">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</button>
			</div>
		</div>

		<MessageList {messages} isTyping={status === 'sending'} isStreaming={status === 'streaming'} {streamedText} />

		{#if errorMsg && status === 'error'}
			<div class="error-bar">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span>{errorMsg}</span>
			</div>
		{/if}

		<MessageInput disabled={status === 'sending' || status === 'streaming'} onSend={handleSend} />
	</div>

	{#if sidebarOpen && isMobile}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="sidebar-overlay" onclick={toggleSidebar} onkeydown={(e) => e.key === 'Escape' && toggleSidebar()} role="presentation"></div>
	{/if}
</div>

<style>
	.app-layout {
		display: flex;
		height: 100vh;
		background: var(--color-surface);
		position: relative;
	}

	.sidebar-wrapper {
		flex-shrink: 0;
		z-index: 20;
		transition: transform var(--transition-base), opacity var(--transition-base);
	}

	.sidebar-wrapper.hidden {
		display: none;
	}

	.chat-widget {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--color-bg);
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, #4f46e5, #6366f1, #818cf8);
		background-size: 200% 200%;
		animation: gradientShift 6s ease infinite;
		color: white;
		box-shadow: 0 2px 12px rgba(79, 70, 229, 0.3);
		z-index: 10;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-info {
		display: flex;
		flex-direction: column;
	}

	.header-title {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: 0.01em;
	}

	.header-subtitle {
		font-size: 0.72rem;
		opacity: 0.8;
		margin-top: 0.05rem;
	}

	.streaming-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.streaming-label::after {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22d3ee;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.icon-btn {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: white;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-fast);
		backdrop-filter: blur(4px);
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: scale(1.05);
	}

	.new-chat-btn {
		border-radius: 50%;
	}

	.new-chat-btn:hover {
		transform: rotate(90deg) scale(1.05);
	}

	.error-bar {
		background: var(--color-error-bg);
		border-top: 1px solid #fecaca;
		padding: 0.55rem 1.25rem;
		font-size: 0.78rem;
		color: var(--color-error);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		animation: fadeIn 0.2s ease;
	}

	.error-bar svg {
		flex-shrink: 0;
	}

	:global(.dark) .error-bar {
		border-top-color: #7f1d1d;
	}

	.sidebar-overlay {
		display: block;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 25;
		backdrop-filter: blur(2px);
		animation: fadeIn 0.2s ease;
	}

	@media (max-width: 768px) {
		.sidebar-wrapper {
			position: fixed;
			left: 0;
			top: 0;
			height: 100vh;
			z-index: 30;
			transform: translateX(-100%);
			transition: transform var(--transition-base);
		}

		.sidebar-wrapper.visible {
			transform: translateX(0);
		}

		.sidebar-wrapper.hidden {
			display: block;
			transform: translateX(-100%);
			pointer-events: none;
		}

		.chat-header {
			position: relative;
			z-index: 15;
		}
	}
</style>

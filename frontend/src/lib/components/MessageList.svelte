<script lang="ts">
	import type { Message } from '$lib/types';

	let {
		messages = [],
		isTyping = false,
		isStreaming = false,
		streamedText = ''
	}: {
		messages: Message[];
		isTyping: boolean;
		isStreaming: boolean;
		streamedText: string;
	} = $props();

	let messagesContainer: HTMLDivElement | undefined = $state();
	let showScrollButton = $state(false);

	$effect(() => {
		if (messages.length || isTyping || isStreaming) {
			requestAnimationFrame(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			});
		}
	});

	function handleScroll() {
		if (!messagesContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		// Show button when scrolled up more than 200px from bottom
		showScrollButton = scrollHeight - scrollTop - clientHeight > 200;
	}

	function scrollToBottom() {
		if (!messagesContainer) return;
		messagesContainer.scrollTo({
			top: messagesContainer.scrollHeight,
			behavior: 'smooth'
		});
	}

	function formatTime(date: Date): string {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const seconds = Math.floor(diffMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);
		const months = Math.floor(days / 30);
		const years = Math.floor(days / 365);

		if (seconds < 60) return 'Just now';
		if (minutes === 1) return '1 min ago';
		if (minutes < 60) return `${minutes} mins ago`;
		if (hours === 1) return '1 hour ago';
		if (hours < 24) return `${hours} hours ago`;
		if (days === 1) return '1 day ago';
		if (days < 30) return `${days} days ago`;
		if (months === 1) return '1 month ago';
		if (months < 12) return `${months} months ago`;
		if (years === 1) return '1 year ago';
		return `${years} years ago`;
	}

	function formatDateSeparator(date: Date): string {
		const d = new Date(date);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

		if (msgDate.getTime() === today.getTime()) return 'Today';
		if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
		if (now.getTime() - msgDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
			return d.toLocaleDateString([], { weekday: 'long' });
		}
		return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
	}

	function isNewDay(current: Date, previous: Date | null): boolean {
		if (!previous) return true;
		const cur = new Date(current.getFullYear(), current.getMonth(), current.getDate());
		const prev = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate());
		return cur.getTime() !== prev.getTime();
	}

	let lastMsgIsStreaming = $derived(
		isStreaming && messages.length > 0 && messages[messages.length - 1].sender === 'ai'
	);

	let lastMessage = $derived(messages.length > 0 ? messages[messages.length - 1] : null);

	function getMessageAnimationDelay(index: number, total: number): string {
		const distanceFromEnd = total - 1 - index;
		return distanceFromEnd * 0.05 + 's';
	}

	const userIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
	const aiIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 2.76-1.12 5.26-2.93 7.07L19 22l-2.93-1.93A10 10 0 1 1 12 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="9" y1="11" x2="15" y2="11"/></svg>';
</script>

<div class="messages-wrapper">
	<div
		bind:this={messagesContainer}
		class="messages-container"
		role="log"
		aria-live="polite"
		aria-label="Chat messages"
		onscroll={handleScroll}
	>
		{#if messages.length === 0 && !isTyping}
			<div class="empty-state">
				<div class="empty-icon-container">
					<div class="empty-icon-glow"></div>
					<div class="empty-icon">✨</div>
				</div>
				<h2 class="empty-heading">Welcome to Spur Support</h2>
				<p class="empty-description">
					I'm your AI assistant. Ask me about shipping, returns, products, or anything about our store!
				</p>
				<div class="suggestions">
					<button
						class="suggestion-chip"
						onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: "What's your return policy?" }))}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
						</svg>
						Return policy
					</button>
					<button
						class="suggestion-chip"
						onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: 'Do you ship internationally?' }))}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
							<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
						</svg>
						International shipping
					</button>
					<button
						class="suggestion-chip"
						onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: 'What are your support hours?' }))}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
						</svg>
						Support hours
					</button>
				</div>
			</div>
		{:else}
			{#each messages as message, i (message.id)}
				{@const msgDate = new Date(message.timestamp)}
				{@const prevMsg = messages[i - 1]}
				{@const showDateSep = !prevMsg || isNewDay(msgDate, new Date(prevMsg.timestamp))}

				{#if showDateSep}
					<div class="date-separator">
						<span class="date-separator-line"></span>
						<span class="date-separator-text">{formatDateSeparator(msgDate)}</span>
						<span class="date-separator-line"></span>
					</div>
				{/if}

				<div
					class="message-wrapper {message.sender}"
					class:user={message.sender === 'user'}
					class:ai={message.sender === 'ai'}
					style="animation-delay: {getMessageAnimationDelay(i, messages.length)}"
				>
					<div class="avatar" class:user-avatar={message.sender === 'user'} class:ai-avatar={message.sender === 'ai'}>
						{#if message.sender === 'user'}
							{@html userIcon}
						{:else}
							{@html aiIcon}
						{/if}
					</div>
					<div class="message-bubble" class:user-bubble={message.sender === 'user'} class:ai-bubble={message.sender === 'ai'}>
						<div class="message-sender">{message.sender === 'user' ? 'You' : 'Spur AI'}</div>
						<div class="message-text">
							{message.text}
							{#if lastMsgIsStreaming && message === lastMessage && !streamedText}
								<span class="streaming-cursor">|</span>
							{/if}
						</div>
						{#if message.text || (!lastMsgIsStreaming || message !== lastMessage)}
							<div class="message-time" title={msgDate.toLocaleString()}>{formatTime(msgDate)}</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if isTyping}
				<div class="message-wrapper ai" style="animation-delay: 0s">
					<div class="avatar ai-avatar">
						{@html aiIcon}
					</div>
					<div class="message-bubble ai-bubble typing-bubble">
						<div class="typing-indicator">
							<span></span><span></span><span></span>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Scroll to bottom button -->
	{#if showScrollButton}
		<button class="scroll-to-bottom" onclick={scrollToBottom} title="Scroll to bottom" aria-label="Scroll to bottom">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.messages-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
		min-height: 0;
	}

	.messages-container {
		height: 100%;
		overflow-y: auto;
		padding: 1.25rem 1.5rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		scroll-behavior: smooth;
		background: var(--color-bg);
	}

	/* ===== Scroll to Bottom Button ===== */
	.scroll-to-bottom {
		position: absolute;
		bottom: 1rem;
		right: 1.25rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		padding: 0.45rem 0.8rem 0.45rem 0.6rem;
		color: var(--color-primary);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		box-shadow: var(--shadow-lg);
		transition: all var(--transition-fast);
		animation: fadeInUp 0.25s ease;
		z-index: 5;
	}

	.scroll-to-bottom:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
		transform: translateY(-2px);
		box-shadow: var(--shadow-xl);
	}

	.scroll-to-bottom:active {
		transform: translateY(0);
	}

	/* ===== Date Separator ===== */
	.date-separator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0 0.5rem;
		animation: fadeIn 0.4s ease;
	}

	.date-separator:first-child {
		padding-top: 0;
	}

	.date-separator-line {
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.date-separator-text {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-text-muted);
		white-space: nowrap;
		letter-spacing: 0.02em;
	}

	/* ===== Empty State ===== */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		padding: 2rem;
		gap: 0.5rem;
		animation: fadeIn 0.6s ease;
	}

	.empty-icon-container {
		position: relative;
		margin-bottom: 0.75rem;
	}

	.empty-icon-glow {
		position: absolute;
		inset: -12px;
		background: radial-gradient(circle, rgba(99, 102, 241, 0.2), transparent 70%);
		border-radius: 50%;
		animation: pulse 3s ease-in-out infinite;
	}

	.empty-icon {
		font-size: 3rem;
		position: relative;
		animation: float 3s ease-in-out infinite;
	}

	.empty-heading {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--color-text);
		background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.empty-description {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		max-width: 340px;
		line-height: 1.5;
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-top: 1rem;
	}

	.suggestion-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		padding: 0.55rem 1rem;
		font-size: 0.78rem;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
		font-family: inherit;
		box-shadow: var(--shadow-sm);
	}

	.suggestion-chip:hover {
		border-color: var(--color-primary-light);
		color: var(--color-primary);
		background: var(--color-primary-bg);
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.suggestion-chip:active {
		transform: translateY(0);
	}

	.suggestion-chip svg {
		flex-shrink: 0;
	}

	/* ===== Messages ===== */
	.message-wrapper {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		max-width: 82%;
		animation: fadeInUp 0.35s ease both;
	}

	.message-wrapper.user {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

	.message-wrapper.ai {
		align-self: flex-start;
	}

	.avatar {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}

	.avatar.user-avatar {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
	}

	.avatar.ai-avatar {
		background: linear-gradient(135deg, #8b5cf6, #6366f1);
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
	}

	.message-bubble {
		padding: 0.65rem 0.9rem;
		border-radius: var(--radius-lg);
		position: relative;
		transition: all var(--transition-fast);
	}

	.message-wrapper.user .message-bubble.user-bubble {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
		color: white;
		border-bottom-right-radius: var(--radius-sm);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
	}

	.message-wrapper.ai .message-bubble.ai-bubble {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-bottom-left-radius: var(--radius-sm);
		box-shadow: var(--shadow-sm);
	}

	.message-sender {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.2rem;
	}

	.message-wrapper.user .message-sender {
		color: rgba(255, 255, 255, 0.75);
	}

	.message-wrapper.ai .message-sender {
		color: var(--color-primary);
	}

	.message-text {
		font-size: 0.9rem;
		line-height: 1.55;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.streaming-cursor {
		display: inline-block;
		font-weight: 400;
		color: var(--color-primary);
		animation: blink 0.7s step-end infinite;
		margin-left: 1px;
		font-size: 1.1rem;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	.message-time {
		font-size: 0.62rem;
		margin-top: 0.3rem;
		font-weight: 400;
	}

	.message-wrapper.user .message-time {
		color: rgba(255, 255, 255, 0.55);
	}

	.message-wrapper.ai .message-time {
		color: var(--color-text-muted);
	}

	/* ===== Typing ===== */
	.typing-bubble {
		padding: 0.9rem 1.1rem;
		min-width: 56px;
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: center;
	}

	.typing-indicator span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-text-muted);
		display: inline-block;
		animation: typing 1.4s infinite ease-in-out;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0%, 60%, 100% {
			transform: translateY(0);
			opacity: 0.3;
		}
		30% {
			transform: translateY(-5px);
			opacity: 1;
		}
	}
</style>

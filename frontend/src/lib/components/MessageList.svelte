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

	// Auto-scroll to bottom when new messages arrive or typing state changes
	$effect(() => {
		if (messages.length || isTyping || isStreaming) {
			requestAnimationFrame(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			});
		}
	});

	function formatTime(date: Date): string {
		const d = new Date(date);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Check if the last message is a streaming (empty-text) AI message
	let lastMsgIsStreaming = $derived(
		isStreaming && messages.length > 0 && messages[messages.length - 1].sender === 'ai'
	);
</script>

<div
	bind:this={messagesContainer}
	class="messages-container"
	role="log"
	aria-live="polite"
	aria-label="Chat messages"
>
	{#if messages.length === 0}
		<div class="empty-state">
			<div class="empty-icon">💬</div>
			<h2>Welcome to Spur Support</h2>
			<p>Ask me about shipping, returns, or anything else about our store!</p>
			<div class="suggestions">
				<button class="suggestion-chip" onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: "What's your return policy?" }))}>
					What's your return policy?
				</button>
				<button class="suggestion-chip" onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: 'Do you ship to USA?' }))}>
					Do you ship to USA?
				</button>
				<button class="suggestion-chip" onclick={() => window.dispatchEvent(new CustomEvent('suggest-message', { detail: 'What are your support hours?' }))}>
					What are your support hours?
				</button>
			</div>
		</div>
	{:else}
		{#each messages as message (message.id)}
			<div
				class="message-wrapper {message.sender}"
				class:user={message.sender === 'user'}
				class:ai={message.sender === 'ai'}
			>
				<div class="avatar">
					{message.sender === 'user' ? '👤' : '🤖'}
				</div>
				<div class="message-bubble">
					<div class="message-sender">
						{message.sender === 'user' ? 'You' : 'Spur AI'}
					</div>
					<div class="message-text">
						{message.text}
						{#if lastMsgIsStreaming && message === messages[messages.length - 1] && streamedText}
							<span class="streaming-cursor">|</span>
						{/if}
					</div>
					<div class="message-time">{formatTime(message.timestamp)}</div>
				</div>
			</div>
		{/each}
	{/if}

	{#if isTyping}
		<div class="message-wrapper ai">
			<div class="avatar">🤖</div>
			<div class="message-bubble typing-bubble">
				<div class="typing-indicator">
					<span></span><span></span><span></span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.messages-container {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-behavior: smooth;
		background: #f8fafc;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		padding: 2rem;
		gap: 0.75rem;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 0.25rem;
	}

	.empty-state h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1e293b;
	}

	.empty-state p {
		margin: 0;
		color: #64748b;
		font-size: 0.9rem;
		max-width: 320px;
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-top: 0.75rem;
	}

	.suggestion-chip {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		color: #3b82f6;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.suggestion-chip:hover {
		background: #eff6ff;
		border-color: #3b82f6;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
	}

	.suggestion-chip:active {
		transform: translateY(0);
	}

	.message-wrapper {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		max-width: 85%;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message-wrapper.user {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

	.message-wrapper.ai {
		align-self: flex-start;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.message-wrapper.user .avatar {
		background: #dbeafe;
	}

	.message-wrapper.ai .avatar {
		background: #e0e7ff;
	}

	.message-bubble {
		padding: 0.75rem 1rem;
		border-radius: 1rem;
		position: relative;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.message-wrapper.user .message-bubble {
		background: #3b82f6;
		color: white;
		border-bottom-right-radius: 0.25rem;
	}

	.message-wrapper.ai .message-bubble {
		background: white;
		color: #1e293b;
		border: 1px solid #e2e8f0;
		border-bottom-left-radius: 0.25rem;
	}

	.message-sender {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
		opacity: 0.7;
	}

	.message-text {
		font-size: 0.925rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.streaming-cursor {
		display: inline-block;
		font-weight: bold;
		color: #3b82f6;
		animation: blink 0.8s step-end infinite;
		margin-left: 1px;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	.message-time {
		font-size: 0.65rem;
		margin-top: 0.35rem;
		opacity: 0.6;
		text-align: right;
	}

	/* Typing indicator */
	.typing-bubble {
		padding: 1rem 1.25rem;
		min-width: 60px;
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: center;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #94a3b8;
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
			opacity: 0.4;
		}
		30% {
			transform: translateY(-6px);
			opacity: 1;
		}
	}
</style>

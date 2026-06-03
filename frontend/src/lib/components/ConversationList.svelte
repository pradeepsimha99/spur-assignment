<script lang="ts">
	import type { ConversationSummary } from '$lib/types';

	let {
		conversations = [],
		activeSessionId = '',
		loading = false,
		onSelect,
		onNewChat
	}: {
		conversations: ConversationSummary[];
		activeSessionId: string;
		loading: boolean;
		onSelect: (sessionId: string) => void;
		onNewChat: () => void;
	} = $props();

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

		if (diffHours < 1) return 'Just now';
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffHours < 48) return 'Yesterday';
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	function truncatePreview(text: string, maxLen: number = 60): string {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen) + '…';
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<div class="sidebar-title">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
			</svg>
			<span>Conversations</span>
		</div>
		<button class="new-btn" onclick={onNewChat} title="New conversation" aria-label="New conversation">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<line x1="5" y1="12" x2="19" y2="12"></line>
			</svg>
		</button>
	</div>

	<div class="conversation-list">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<span>Loading conversations…</span>
			</div>
		{:else if conversations.length === 0}
			<div class="empty-state">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
				</svg>
				<span>No conversations yet</span>
				<span class="empty-hint">Start a new chat to begin</span>
			</div>
		{:else}
			{#each conversations as conv (conv.id)}
				<button
					class="conversation-item"
					class:active={conv.id === activeSessionId}
					onclick={() => onSelect(conv.id)}
					title={conv.preview}
				>
					<div class="conv-avatar">
						{conv.messageCount > 0 ? '💬' : '🆕'}
					</div>
					<div class="conv-content">
						<div class="conv-preview">{truncatePreview(conv.preview)}</div>
						<div class="conv-meta">
							<span class="conv-time">{formatDate(conv.lastMessageAt)}</span>
							<span class="conv-count">{conv.messageCount} msg</span>
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>

	<div class="sidebar-footer">
		<button class="new-chat-btn-wide" onclick={onNewChat}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<line x1="5" y1="12" x2="19" y2="12"></line>
			</svg>
			New Conversation
		</button>
	</div>
</aside>

<style>
	.sidebar {
		width: 280px;
		min-width: 280px;
		background: #ffffff;
		border-right: 1px solid #e2e8f0;
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1rem 0.75rem;
		border-bottom: 1px solid #f1f5f9;
	}

	.sidebar-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: #1e293b;
	}

	.new-btn {
		width: 30px;
		height: 30px;
		border-radius: 0.5rem;
		border: none;
		background: #f1f5f9;
		color: #64748b;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.new-btn:hover {
		background: #3b82f6;
		color: white;
	}

	.conversation-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: #94a3b8;
		font-size: 0.85rem;
		text-align: center;
	}

	.empty-hint {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid #e2e8f0;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.conversation-item {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
		font-family: inherit;
	}

	.conversation-item:hover {
		background: #f8fafc;
	}

	.conversation-item.active {
		background: #eff6ff;
		outline: 1px solid #bfdbfe;
	}

	.conv-avatar {
		font-size: 1rem;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.conv-content {
		flex: 1;
		min-width: 0;
	}

	.conv-preview {
		font-size: 0.85rem;
		color: #1e293b;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.conv-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}

	.conv-time {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.conv-count {
		font-size: 0.65rem;
		color: #94a3b8;
		background: #f1f5f9;
		padding: 0.05rem 0.4rem;
		border-radius: 0.25rem;
	}

	.sidebar-footer {
		padding: 0.75rem;
		border-top: 1px solid #f1f5f9;
	}

	.new-chat-btn-wide {
		width: 100%;
		padding: 0.6rem;
		border-radius: 0.5rem;
		border: 1px dashed #cbd5e1;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-family: inherit;
		transition: all 0.15s ease;
	}

	.new-chat-btn-wide:hover {
		background: #f8fafc;
		border-color: #3b82f6;
		color: #3b82f6;
	}

	@media (max-width: 768px) {
		.sidebar {
			display: none;
		}
	}
</style>

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

	let searchQuery = $state('');
	let searchRef: HTMLInputElement | undefined = $state();

	let filteredConversations = $derived.by(() => {
		if (!searchQuery.trim()) return conversations;
		const query = searchQuery.toLowerCase();
		return conversations.filter((c) => c.preview.toLowerCase().includes(query));
	});

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
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

	function truncatePreview(text: string, maxLen: number = 55): string {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen) + '…';
	}

	function clearSearch() {
		searchQuery = '';
		if (searchRef) searchRef.focus();
	}

	// Generate skeleton items for loading state
	const skeletonItems = Array.from({ length: 6 }, (_, i) => i);
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<div class="sidebar-title">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
			<span>Conversations</span>
			{#if !loading && conversations.length > 0}
				<span class="count-badge">{conversations.length}</span>
			{/if}
		</div>
		<button class="new-btn" onclick={onNewChat} title="New conversation" aria-label="New conversation">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
			</svg>
		</button>
	</div>

	<!-- Search bar -->
	<div class="search-container">
		<div class="search-wrapper">
			<svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				bind:this={searchRef}
				type="text"
				bind:value={searchQuery}
				placeholder="Search conversations..."
				class="search-input"
				aria-label="Search conversations"
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={clearSearch} aria-label="Clear search">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="conversation-list">
		{#if loading}
			<!-- Skeleton Loading -->
			{#each skeletonItems as i}
				<div class="skeleton-item" style="animation-delay: {i * 0.06}s">
					<div class="skeleton-avatar shimmer"></div>
					<div class="skeleton-content">
						<div class="skeleton-line shimmer" style="width: {[75, 65, 80, 55, 70, 85][i] || 70}%"></div>
						<div class="skeleton-line shimmer" style="width: {[45, 55, 35, 50, 40, 60][i] || 45}%; height: 10px; margin-top: 6px;"></div>
					</div>
				</div>
			{/each}
		{:else if filteredConversations.length === 0}
			<div class="empty-state">
				<div class="empty-icon-wrapper">
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
				</div>
				<span class="empty-title">{searchQuery ? 'No matching conversations' : 'No conversations yet'}</span>
				<span class="empty-hint">{searchQuery ? 'Try a different search term' : 'Start a new chat to begin'}</span>
			</div>
		{:else}
			{#each filteredConversations as conv (conv.id)}
				<button
					class="conversation-item"
					class:active={conv.id === activeSessionId}
					onclick={() => onSelect(conv.id)}
					title={conv.preview}
				>
					<div class="conv-avatar" class:active-avatar={conv.id === activeSessionId}>
						{conv.messageCount > 0 ? '💬' : '🆕'}
					</div>
					<div class="conv-content">
						<div class="conv-preview">{truncatePreview(conv.preview)}</div>
						<div class="conv-meta">
							<span class="conv-time">{formatDate(conv.lastMessageAt)}</span>
							<span class="conv-count">{conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}</span>
						</div>
					</div>
					{#if conv.id === activeSessionId}
						<div class="active-indicator"></div>
					{/if}
				</button>
			{/each}
		{/if}
	</div>

	<div class="sidebar-footer">
		<button class="new-chat-btn-wide" onclick={onNewChat}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			New Conversation
		</button>
	</div>
</aside>

<style>
	.sidebar {
		width: 300px;
		min-width: 300px;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1rem 0.85rem;
		border-bottom: 1px solid var(--color-border-light);
	}

	.sidebar-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-text);
	}

	.sidebar-title svg {
		color: var(--color-primary);
	}

	.count-badge {
		background: var(--color-primary-bg);
		color: var(--color-primary);
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-full);
		margin-left: 0.15rem;
	}

	.new-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-border-light);
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}

	.new-btn:hover {
		background: var(--color-primary);
		color: white;
		transform: rotate(90deg);
		box-shadow: var(--shadow-md);
	}

	/* ===== Search Bar ===== */
	.search-container {
		padding: 0.6rem 0.75rem 0.4rem;
	}

	.search-wrapper {
		display: flex;
		align-items: center;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.35rem 0.6rem;
		transition: all var(--transition-fast);
	}

	.search-wrapper:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.search-icon {
		flex-shrink: 0;
		color: var(--color-text-muted);
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		padding: 0.25rem 0.4rem;
		font-size: 0.8rem;
		font-family: inherit;
		color: var(--color-text);
		outline: none;
		min-width: 0;
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}

	.search-clear {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
	}

	.search-clear:hover {
		color: var(--color-text);
		background: var(--color-surface-hover);
	}

	.conversation-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/* ===== Skeleton Loading ===== */
	.skeleton-item {
		display: flex;
		gap: 0.65rem;
		padding: 0.7rem 0.75rem;
		border-radius: var(--radius-md);
		animation: fadeIn 0.4s ease both;
	}

	.skeleton-avatar {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 2px;
	}

	.skeleton-line {
		height: 12px;
		border-radius: var(--radius-sm);
	}

	/* ===== Empty State ===== */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2.5rem 1.5rem;
		color: var(--color-text-muted);
		font-size: 0.85rem;
		text-align: center;
	}

	.empty-icon-wrapper {
		width: 56px;
		height: 56px;
		background: var(--color-border-light);
		border-radius: var(--radius-xl);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
		margin-bottom: 0.25rem;
	}

	.empty-title {
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.empty-hint {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	/* ===== Conversation Items ===== */
	.conversation-item {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border-radius: var(--radius-md);
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: left;
		width: 100%;
		font-family: inherit;
		position: relative;
		animation: fadeIn 0.3s ease both;
	}

	.conversation-item:hover {
		background: var(--color-surface-hover);
	}

	.conversation-item.active {
		background: var(--color-primary-bg);
	}

	.conv-avatar {
		font-size: 1rem;
		flex-shrink: 0;
		margin-top: 1px;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: var(--color-border-light);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}

	.conv-avatar.active-avatar {
		background: var(--color-primary);
	}

	.conv-content {
		flex: 1;
		min-width: 0;
	}

	.conv-preview {
		font-size: 0.85rem;
		color: var(--color-text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.conversation-item.active .conv-preview {
		color: var(--color-primary-dark);
	}

	.conv-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}

	.conv-time {
		font-size: 0.68rem;
		color: var(--color-text-muted);
	}

	.conv-count {
		font-size: 0.62rem;
		color: var(--color-text-muted);
		background: var(--color-border-light);
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-sm);
	}

	.active-indicator {
		width: 3px;
		height: 100%;
		background: var(--color-primary);
		border-radius: var(--radius-full);
		position: absolute;
		right: -0.5rem;
		top: 0;
		animation: scaleIn 0.2s ease;
	}

	/* ===== Footer ===== */
	.sidebar-footer {
		padding: 0.75rem;
		border-top: 1px solid var(--color-border-light);
	}

	.new-chat-btn-wide {
		width: 100%;
		padding: 0.65rem;
		border-radius: var(--radius-md);
		border: 1px dashed var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-family: inherit;
		transition: all var(--transition-fast);
	}

	.new-chat-btn-wide:hover {
		background: var(--color-primary-bg);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* ===== Mobile ===== */
	@media (max-width: 768px) {
		.sidebar {
			width: 280px;
			min-width: 280px;
			border-right: none;
			border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
			box-shadow: var(--shadow-xl);
		}
	}
</style>

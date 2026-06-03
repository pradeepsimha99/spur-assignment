<script lang="ts">
	let { disabled = false, onSend }: { disabled?: boolean; onSend: (text: string) => void } = $props();

	let inputText = $state('');

	function handleSubmit() {
		const text = inputText.trim();
		if (!text || disabled) return;
		onSend(text);
		inputText = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<form class="input-container" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<input
		type="text"
		bind:value={inputText}
		onkeydown={handleKeydown}
		placeholder="Type your message..."
		disabled={disabled}
		aria-label="Message input"
		autocomplete="off"
		maxlength="2000"
	/>
	<button
		type="submit"
		disabled={disabled || !inputText.trim()}
		aria-label="Send message"
		class="send-button"
	>
		{#if disabled}
			<span class="spinner"></span>
		{:else}
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="22" y1="2" x2="11" y2="13"></line>
				<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
			</svg>
		{/if}
	</button>
</form>

<style>
	.input-container {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		background: white;
		border-top: 1px solid #e2e8f0;
		align-items: center;
	}

	input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		font-size: 0.925rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		background: #f8fafc;
	}

	input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
		background: white;
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	input::placeholder {
		color: #94a3b8;
	}

	.send-button {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: none;
		background: #3b82f6;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.send-button:hover:not(:disabled) {
		background: #2563eb;
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.send-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.send-button:disabled {
		background: #cbd5e1;
		cursor: not-allowed;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

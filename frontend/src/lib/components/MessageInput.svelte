<script lang="ts">
	import { onMount } from 'svelte';

	let { disabled = false, onSend }: { disabled?: boolean; onSend: (text: string) => void } = $props();

	let inputText = $state('');
	let inputRef: HTMLInputElement | undefined = $state();
	let isFocused = $state(false);

	onMount(() => {
		// Listen for Ctrl+K shortcut to focus input
		window.addEventListener('focus-message-input', handleFocusRequest);
		return () => window.removeEventListener('focus-message-input', handleFocusRequest);
	});

	function handleFocusRequest() {
		if (inputRef && !disabled) {
			inputRef.focus();
		}
	}

	function handleSubmit() {
		const text = inputText.trim();
		if (!text || disabled) return;
		onSend(text);
		inputText = '';
		if (inputRef) inputRef.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<form class="input-container" class:focused={isFocused} onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="input-wrapper">
		<input
			bind:this={inputRef}
			type="text"
			bind:value={inputText}
			onkeydown={handleKeydown}
			onfocus={() => isFocused = true}
			onblur={() => isFocused = false}
			placeholder="Type your message..."
			disabled={disabled}
			aria-label="Message input"
			autocomplete="off"
			maxlength="2000"
		/>
	</div>
	<button
		type="submit"
		disabled={disabled || !inputText.trim()}
		aria-label="Send message"
		class="send-button"
		class:has-text={inputText.trim().length > 0}
	>
		{#if disabled}
			<span class="spinner"></span>
		{:else}
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="22" y1="2" x2="11" y2="13" />
				<polygon points="22 2 15 22 11 13 2 9 22 2" />
			</svg>
		{/if}
	</button>
</form>

<style>
	.input-container {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1.25rem 1.25rem;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		align-items: flex-end;
		transition: border-color var(--transition-fast);
	}

	.input-container.focused {
		border-top-color: var(--color-primary-light);
	}

	.input-wrapper {
		flex: 1;
		display: flex;
		align-items: center;
		background: var(--color-bg);
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-lg);
		transition: all var(--transition-fast);
	}

	.input-container.focused .input-wrapper {
		border-color: var(--color-primary);
		background: var(--color-surface);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	input {
		flex: 1;
		padding: 0.7rem 0.9rem;
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9rem;
		font-family: inherit;
		outline: none;
		background: transparent;
		color: var(--color-text);
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input::placeholder {
		color: var(--color-text-muted);
		font-size: 0.88rem;
	}

	.send-button {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: var(--color-border-light);
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-fast);
		flex-shrink: 0;
	}

	.send-button.has-text {
		background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
		color: white;
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
	}

	.send-button.has-text:hover {
		transform: scale(1.08);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
	}

	.send-button.has-text:active {
		transform: scale(0.95);
	}

	.send-button:disabled {
		cursor: not-allowed;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(99, 102, 241, 0.2);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>

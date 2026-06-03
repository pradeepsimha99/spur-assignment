<script lang="ts">
	import ChatWidget from '$lib/components/ChatWidget.svelte';
</script>

<div class="page-container">
	<ChatWidget />
</div>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: var(--color-bg);
	}

	:global(body) {
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.page-container {
			flex-direction: row;
		}
	}
</style>

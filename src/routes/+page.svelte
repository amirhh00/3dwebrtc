<script lang="ts">
  import Game from '$lib/components/three/App.svelte';

  const { data } = $props();
</script>

<div class="relative w-full h-full">
  {#if data.user}
    <Game user={data.user} />
  {/if}
</div>

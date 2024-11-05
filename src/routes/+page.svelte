<script lang="ts">
  import Game from '$lib/components/three/App.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    if (typeof window !== 'undefined') {
      const es = new EventSource('/api/game');
      es.onmessage = (event) => {
        console.log(event.data);
      };
    }
  });
</script>

<div class="relative w-full h-full">
  <Game />
</div>

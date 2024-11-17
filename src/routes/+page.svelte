<script lang="ts">
  import Game from '$lib/components/three/App.svelte';
  import { onMount } from 'svelte';
  import type { UserServer } from '$lib/@types/user.type';
  import { PUBLIC_BASE_URL } from '$env/static/public';

  let user = $state<UserServer>();

  onMount(async () => {
    const res = await fetch(`${PUBLIC_BASE_URL}/api/user`, {
      credentials: 'include'
      // mode: 'no-cors'
    });
    user = await res.json();
  });
</script>

<div class="relative w-full h-full">
  {#if user}
    <Game {user} />
  {:else}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-2xl">Loading...</div>
    </div>
  {/if}
</div>

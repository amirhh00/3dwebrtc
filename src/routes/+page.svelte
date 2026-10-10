<script lang="ts">
  import Game from '$lib/components/three/App.svelte';
  import { onMount } from 'svelte';
  import type { UserServer } from '$lib/@types/user.type';
  import { PUBLIC_BASE_URL } from '$env/static/public';

  let user = $state<UserServer>();

  onMount(async () => {
    try {
      // 1. Try relative URL first (Vite proxy)
      let res = await fetch('/api/user', { credentials: 'include' }).catch(() => null);
      if (!res || !res.ok) {
        // 2. Try configured PUBLIC_BASE_URL
        res = await fetch(`${PUBLIC_BASE_URL}/api/user`, { credentials: 'include' }).catch(
          () => null
        );
      }

      if (res && res.ok) {
        user = await res.json();
        return;
      }
    } catch {
      // Ignore network errors and use fallback
    }

    // 3. Fallback user so game always boots reliably even without backend
    user = {
      id: 'player_' + Math.random().toString(36).substring(2, 9),
      name: 'Player_' + Math.floor(Math.random() * 900 + 100),
      color: '#0284c7',
      is_host: false,
      room_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });
</script>

<div class="relative h-full w-full">
  {#if user}
    <Game {user} />
  {:else}
    <div class="bg-background absolute inset-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent"
        ></div>
        <div class="text-xl font-bold tracking-wider text-cyan-400">LOADING VR WORLD...</div>
      </div>
    </div>
  {/if}
</div>

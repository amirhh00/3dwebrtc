<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
  import MainMenu from '$lib/components/layout/MainMenu.svelte';
  import { browser } from '$app/environment';
  import ChatBox from '$lib/components/ChatBox.svelte';
  import GameEventLog from '$lib/components/GameEventLog.svelte';
  import { onMount } from 'svelte';
  import { playerInfo, gameState } from '$lib/store/game.svelte';
  import type { UserServer } from '$lib/@types/user.type';

  interface MainMenuProps {
    user: UserServer;
  }

  const { user }: MainMenuProps = $props();

  onMount(() => {
    if (browser) {
      playerInfo.playerName = user.name;
      playerInfo.playerColor = user.color || '#000000';
      gameState.userId = user.id;
    }
  });
</script>

<div class="absolute h-full w-full">
  <MainMenu />

  <div class="h-full w-full">
    <Canvas>
      <!-- {#if dev}
        <PerfMonitor anchorY="bottom" />
      {/if} -->
      <World>
        <Scene />
      </World>
    </Canvas>
  </div>
  <GameEventLog />
  <ChatBox />
</div>

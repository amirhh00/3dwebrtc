<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
  import MainMenu from '$lib/components/layout/MainMenu.svelte';
  import { browser } from '$app/environment';
  import ChatBox from '$lib/components/ChatBox.svelte';
  import GameEventLog from '$lib/components/GameEventLog.svelte';
  import VoiceActivityMonitor from '$lib/components/VoiceActivityMonitor.svelte';
  import { onMount } from 'svelte';
  import { playerInfo, gameState } from '$lib/store/game.svelte';
  import type { UserServer } from '$lib/@types/user.type';

  interface MainMenuProps {
    user: UserServer;
  }

  const { user }: MainMenuProps = $props();
  let isPointerLocked = $state(false);

  onMount(() => {
    if (browser) {
      playerInfo.playerName = user.name;
      playerInfo.playerColor = user.color || '#000000';
      gameState.userId = user.id;
    }

    const handlePointerLockChange = () => {
      isPointerLocked = document.pointerLockElement !== null;
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  });
</script>

<div class="absolute h-full w-full">
  <VoiceActivityMonitor />
  <MainMenu />

  <div class="h-full w-full">
    {#if !isPointerLocked}
      <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div class="bg-black bg-opacity-50 text-white px-4 py-2 rounded text-center pointer-events-auto">
          <p class="text-sm mb-2">Click to look around with mouse</p>
          <p class="text-xs opacity-75">Press ESC to unlock cursor</p>
        </div>
      </div>
    {/if}
    
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

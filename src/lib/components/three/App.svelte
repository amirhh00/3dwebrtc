<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
  import MainMenu from '$lib/components/layout/MainMenu.svelte';
  import { PerfMonitor } from '@threlte/extras';
  import { dev } from '$app/environment';
</script>

<div class="absolute h-full w-full">
  <MainMenu />

  <div class="h-full w-full">
    <Canvas>
      {#if dev}
        <PerfMonitor />
      {/if}
      <World>
        <Scene />
      </World>
    </Canvas>
  </div>
</div>

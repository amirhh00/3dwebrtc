<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
  import MainMenu from '$lib/components/layout/MainMenu.svelte';
  import { browser } from '$app/environment';
</script>

<div class="absolute h-full w-full">
  <MainMenu />

  {#if browser}
    <div class="h-full w-full">
      <Canvas>
        <World>
          <Scene />
        </World>
      </Canvas>
    </div>
  {/if}
</div>

<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
  import MainMenu from '../layout/MainMenu.svelte';
</script>

<div class="relative h-full w-full">
  <MainMenu />
  <Canvas>
    <World>
      <Scene />
    </World>
  </Canvas>
</div>

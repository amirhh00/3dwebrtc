<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World } from '@threlte/rapier';
  import Scene from './Scene.svelte';
</script>

<div>
  <Canvas>
    <World>
      <Scene />
    </World>
  </Canvas>
</div>

<style>
  div {
    position: relative;
    height: 100%;
    width: 100%;
  }
</style>

<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML, PositionalAudio } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import { type Group, type Mesh, type PositionalAudio as threePositionalAudio } from 'three';
  import { gameState } from '$lib/store/game.svelte';
  import { onDestroy } from 'svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let modelMesh = $state<Mesh>();
  let tref = $state<Group>();
  let pAudio = $state<threePositionalAudio>();
  const { camera } = useThrelte();
  const user = gameState.room.players?.find((p) => p.id === playerId);

  useTask(() => {
    tref?.lookAt(camera.current.position.x, height, camera.current.position.z);
    if (playerId !== gameState.userId) {
      // if is one of otherPlayers
      const player = gameState.room.players?.find((p) => p.id === playerId);
      if (player && modelMesh && player.position) {
        const [x, y, z] = player.position as [number, number, number];
        modelMesh.position.set(x, y, z);
      }
    }
  });

  $effect(() => {
    if (pAudio) {
      window.pa = pAudio;
      // pAudio.stop();
      // pAudio.play();
    }
  });

  onDestroy(() => {
    if (pAudio) {
      window.pa = undefined;
    }
  });
</script>

<T.Mesh bind:ref={modelMesh as any} {...meshProps as any}>
  <T.Group bind:ref={tref}>
    <HTML zIndexRange={[0, 1]} center pointerEvents="none" transform position.y={height}>
      <p class="text-xs">
        {!!playerName ? playerName : playerId}
      </p>
    </HTML>
  </T.Group>
  <T.MeshBasicMaterial color={playerColor} />
  <T.CapsuleGeometry args={[radius, height]} />

  {#if playerId !== gameState.userId && user?.mic && user.stream}
    <PositionalAudio
      id="al"
      bind:ref={pAudio}
      refDistance={10}
      volume={1}
      maxDistance={100}
      src={user.stream}
    />
  {/if}
</T.Mesh>

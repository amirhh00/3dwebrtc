<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import type { Group, Mesh } from 'three';
  import { gameState } from '$lib/store/game.svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let modelMesh = $state<Mesh>();
  let tref = $state<Group>();
  const { camera } = useThrelte();

  useTask(() => {
    tref?.lookAt(camera.current.position.x, height, camera.current.position.z);
    if (playerId !== gameState.userId) {
      // if is one of otherPlayers
      const player = gameState.room.players!.find((p) => p.id === playerId);
      if (player && modelMesh && player.position) {
        const [x, y, z] = player.position as [number, number, number];
        modelMesh.position.set(x, y, z);
      }
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
</T.Mesh>

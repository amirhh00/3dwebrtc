<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import type { Group, Mesh, Vector3 } from 'three';
  import { gameState } from '$lib/store/game.svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let modelMesh = $state<Mesh>();
  let tref = $state<Group>();
  const { camera } = useThrelte();

  useTask(() => {
    tref?.lookAt(camera.current.position.x, height, camera.current.position.z);
    if (playerId !== gameState.userId) {
      // always face the player
      if (gameState.room?.players?.length && gameState.room.players.length > 1) {
        for (let i = 0; i < gameState.room.players.length; i++) {
          const player = gameState.room.players[i];
          if (player.id === playerId && player.position && modelMesh) {
            const pos = player.position as unknown as Vector3;
            modelMesh.position.set(pos.x, pos.y, pos.z);
          }
        }
      }
    }
  });
</script>

<T.Mesh
  bind:ref={modelMesh as any}
  {...meshProps as any}
  position={(meshProps?.position as any) ?? [Math.random() * 10, 3, Math.random() * 5]}
>
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

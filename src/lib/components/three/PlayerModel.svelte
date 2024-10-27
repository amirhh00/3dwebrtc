<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import type { Group } from 'three';
  import { gameState } from '$lib/store/game.svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let position = $state((meshProps?.position as any) ?? [Math.random() * 10, 3, Math.random() * 5]);

  let tref = $state<Group>();
  const { camera } = useThrelte();

  console.log(playerName, playerColor, radius, height, '');

  useTask(() => {
    if (tref && playerName !== gameState.userId) {
      // always face the player
      tref.lookAt(camera.current.position.x, height, camera.current.position.z);
      if (gameState.room?.players?.length && gameState.room.players.length > 1) {
        for (let i = 0; i < gameState.room.players.length; i++) {
          const element = gameState.room.players[i];
          if (element.id === playerId && element.position) {
            position = element.position;
          }
        }
      }
    }
  });
</script>

<T.Mesh {...meshProps as any} {position}>
  {#if playerName}
    <T.Group bind:ref={tref}>
      <HTML zIndexRange={[0, 1]} center pointerEvents="none" transform position.y={height}>
        <p class="text-xs">
          {playerName}
        </p>
      </HTML>
    </T.Group>
  {/if}
  <T.MeshBasicMaterial color={playerColor} />
  <T.CapsuleGeometry args={[radius, height]} />
</T.Mesh>

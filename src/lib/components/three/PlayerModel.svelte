<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import { type Group, type Mesh } from 'three';
  import { gameState } from '$lib/store/game.svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let modelMesh = $state<Mesh>();
  let tref = $state<Group>();
  let audioElement = $state<HTMLAudioElement>();
  const { camera } = useThrelte();

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

  // Check if stream is valid and has audio tracks
  let isStreamReady = $state(false);

  $effect(() => {
    const player = gameState.room.players?.find((p) => p.id === playerId);
    if (player?.stream) {
      const audioTracks = player.stream.getAudioTracks();
      isStreamReady = audioTracks.length > 0 && audioTracks[0]?.readyState === 'live';
      if (isStreamReady) {
        console.log(
          `[AUDIO] ✅ Stream ready for ${playerId}. Tracks: ${audioTracks.length}, state: ${audioTracks[0]?.readyState}`
        );
      } else {
        console.warn(
          `[AUDIO] ⚠️ Stream not ready for ${playerId}. Tracks: ${audioTracks.length}, state: ${audioTracks[0]?.readyState}`
        );
        isStreamReady = false;
      }
    } else {
      isStreamReady = false;
    }
  });

  $effect(() => {
    if (audioElement && playerId !== gameState.userId) {
      const player = gameState.room.players?.find((p) => p.id === playerId);
      if (player?.mic && isStreamReady && player.stream) {
        console.log(`[AUDIO] 🎧 Setting stream to audio element for ${playerId}`);
        audioElement.srcObject = player.stream;
        console.log(`[AUDIO] ▶️ Playing audio for ${playerId}`);
        void audioElement.play().catch((e) => {
          console.error(`[AUDIO] ❌ Failed to play audio for ${playerId}:`, e);
        });
      } else {
        console.log(`[AUDIO] ⏸️ Stopping audio for ${playerId}`);
        audioElement.pause();
        audioElement.srcObject = null;
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

  <!-- Hidden audio element for playback -->
  {#if playerId !== gameState.userId && isStreamReady}
    <audio
      bind:this={audioElement}
      autoplay
      muted={false}
      crossorigin="anonymous"
      onerror={(e) => console.warn('[audio] Audio element error:', e)}
    ></audio>
  {/if}
</T.Mesh>

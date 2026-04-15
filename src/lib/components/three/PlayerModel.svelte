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
  let currentStreamId = $state<string | null>(null);
  let isPlaying = $state(false);

  $effect(() => {
    const player = gameState.room.players?.find((p) => p.id === playerId);
    if (player?.stream) {
      const audioTracks = player.stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;
      const trackReady = hasAudio && audioTracks[0]?.readyState === 'live';
      isStreamReady = trackReady;
    } else {
      isStreamReady = false;
    }
  });

  $effect(() => {
    if (audioElement && playerId !== gameState.userId) {
      const player = gameState.room.players?.find((p) => p.id === playerId);
      if (player?.mic && isStreamReady && player.stream) {
        // Only set source and play if stream changed
        const streamId = player.stream.id;
        if (currentStreamId !== streamId) {
          audioElement.pause();
          audioElement.srcObject = player.stream;
          currentStreamId = streamId;
          isPlaying = false;
          
          // Only play after a brief delay to ensure source is set
          setTimeout(() => {
            if (audioElement && audioElement.srcObject === player.stream) {
              void audioElement.play()
                .then(() => {
                  isPlaying = true;
                })
                .catch((e) => {
                  isPlaying = false;
                });
            }
          }, 0);
        }
      } else {
        if (audioElement.srcObject) {
          audioElement.pause();
          audioElement.srcObject = null;
          currentStreamId = null;
          isPlaying = false;
        }
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
    ></audio>
  {/if}
</T.Mesh>

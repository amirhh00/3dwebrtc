<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { Text } from '@threlte/extras';
  import type { PlayerModelProps } from '$lib/@types/3D.type';
  import { type Group, type Mesh, Vector3 } from 'three';
  import { gameState, playerInfo } from '$lib/store/game.svelte';
  import HealthBar from './HealthBar.svelte';
  import VRHandModel from './VRHandModel.svelte';

  const { playerName, playerId, playerColor, radius, height, meshProps }: PlayerModelProps =
    $props();

  let modelMesh = $state<Mesh>();
  let tref = $state<Group>();
  let audioElement = $state<HTMLAudioElement>();
  const { camera, renderer } = useThrelte();
  const viewerPos = new Vector3();

  const player = $derived(
    playerId === gameState.userId
      ? { health: playerInfo.health, isVR: false, leftHand: undefined, rightHand: undefined }
      : gameState.room.players?.find((p) => p.id === playerId)
  );
  const health = $derived(player?.health ?? 100);

  const leftTrigger = $derived(player?.leftHand?.trigger ?? 0);
  const leftGrip = $derived(player?.leftHand?.grip ?? 0);
  const leftThumb = $derived(player?.leftHand?.thumb ?? 0);

  const rightTrigger = $derived(player?.rightHand?.trigger ?? 0);
  const rightGrip = $derived(player?.rightHand?.grip ?? 0);
  const rightThumb = $derived(player?.rightHand?.thumb ?? 0);
  const isPlayerVR = $derived(Boolean(player?.isVR));

  let idleTime = 0;
  let breathOffset = $state(0);

  $effect(() => {
    if (modelMesh) {
      modelMesh.userData.playerId = playerId;
    }
  });

  useTask((delta) => {
    idleTime += delta;
    breathOffset = Math.sin(idleTime * 2.2) * 0.015;

    try {
      if (renderer?.xr?.isPresenting) {
        renderer.xr.getCamera().getWorldPosition(viewerPos);
      } else if (camera?.current) {
        camera.current.getWorldPosition(viewerPos);
      }
      tref?.lookAt(viewerPos.x, height, viewerPos.z);
    } catch {}
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
              void audioElement
                .play()
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
    <Text
      text={playerName ? playerName : playerId}
      fontSize={0.16}
      color="#ffffff"
      anchorX="center"
      anchorY="bottom"
      position.y={height + 0.25}
    />
    <HealthBar {health} {height} />
  </T.Group>
  <T.MeshStandardMaterial color={playerColor} metalness={0.5} roughness={0.4} />
  <T.CapsuleGeometry args={[radius, height]} />

  <!-- Cyber Helmet Visor -->
  <T.Mesh position={[0, height * 0.32, radius * 0.85]}>
    <T.BoxGeometry args={[radius * 1.3, 0.09, 0.12]} />
    <T.MeshStandardMaterial
      color="#0284c7"
      emissive="#38bdf8"
      emissiveIntensity={0.8}
      roughness={0.2}
    />
  </T.Mesh>

  <!-- Cyber Chest Armor & Reactor -->
  <T.Mesh position={[0, height * 0.06, radius * 0.82]}>
    <T.BoxGeometry args={[radius * 1.4, height * 0.32, 0.08]} />
    <T.MeshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
  </T.Mesh>
  <T.Mesh position={[0, height * 0.06, radius * 0.88]} rotation.x={Math.PI / 2}>
    <T.CylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
    <T.MeshBasicMaterial color={isPlayerVR ? '#06b6d4' : '#38bdf8'} />
  </T.Mesh>

  <!-- Jump Jet Backpack -->
  <T.Mesh position={[0, height * 0.05, -radius * 0.85]}>
    <T.BoxGeometry args={[radius * 1.3, height * 0.38, 0.12]} />
    <T.MeshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
  </T.Mesh>
  <T.Mesh position={[-0.1, -height * 0.16, -radius * 0.88]} rotation.x={Math.PI / 2}>
    <T.CylinderGeometry args={[0.025, 0.035, 0.05, 12]} />
    <T.MeshBasicMaterial color="#ef4444" />
  </T.Mesh>
  <T.Mesh position={[0.1, -height * 0.16, -radius * 0.88]} rotation.x={Math.PI / 2}>
    <T.CylinderGeometry args={[0.025, 0.035, 0.05, 12]} />
    <T.MeshBasicMaterial color="#ef4444" />
  </T.Mesh>

  <!-- Left Arm & VR Hand reacting to left controller -->
  <T.Group position={[-radius - 0.06, height * 0.2 + breathOffset, 0]}>
    <!-- Left Shoulder Pad -->
    <T.Mesh>
      <T.SphereGeometry args={[0.065, 8, 8]} />
      <T.MeshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
    </T.Mesh>
    <!-- Left Arm Segment -->
    <T.Group
      position={[isPlayerVR ? -0.05 : -0.04, isPlayerVR ? -0.1 : -0.16, isPlayerVR ? 0.12 : 0.04]}
      rotation.x={isPlayerVR ? -0.3 : 0.15}
      rotation.y={isPlayerVR ? 0.4 : 0.1}
      rotation.z={isPlayerVR ? 0.15 : 0.05}
    >
      <T.Mesh position={[0, -0.04, 0]}>
        <T.CylinderGeometry args={[0.032, 0.028, 0.14, 8]} />
        <T.MeshStandardMaterial color={playerColor} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <!-- Elbow -->
      <T.Mesh position={[0, -0.12, 0]}>
        <T.SphereGeometry args={[0.035, 8, 8]} />
        <T.MeshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </T.Mesh>
      <!-- Forearm -->
      <T.Mesh position={[0, -0.18, 0.04]} rotation.x={0.4}>
        <T.CylinderGeometry args={[0.028, 0.024, 0.13, 8]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </T.Mesh>
      <!-- Left Hand -->
      <T.Group
        position={[0, -0.26, 0.09]}
        rotation.x={isPlayerVR ? 0.8 : 0.4}
        rotation.y={isPlayerVR ? 0.3 : 0}
      >
        <VRHandModel
          handedness="left"
          color={playerColor}
          trigger={leftTrigger}
          grip={leftGrip}
          thumb={leftThumb}
          showWristHud={true}
          {health}
          scale={0.75}
        />
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- Right Arm & VR Hand reacting to right controller -->
  <T.Group position={[radius + 0.06, height * 0.2 + breathOffset, 0]}>
    <!-- Right Shoulder Pad -->
    <T.Mesh>
      <T.SphereGeometry args={[0.065, 8, 8]} />
      <T.MeshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
    </T.Mesh>
    <!-- Right Arm Segment -->
    <T.Group
      position={[isPlayerVR ? 0.04 : 0.03, isPlayerVR ? -0.05 : -0.12, isPlayerVR ? 0.18 : 0.1]}
      rotation.x={isPlayerVR ? -0.1 : 0.25}
      rotation.y={isPlayerVR ? -0.2 : -0.1}
      rotation.z={isPlayerVR ? -0.1 : -0.05}
    >
      <T.Mesh position={[0, -0.04, 0]}>
        <T.CylinderGeometry args={[0.032, 0.028, 0.14, 8]} />
        <T.MeshStandardMaterial color={playerColor} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <!-- Elbow -->
      <T.Mesh position={[0, -0.12, 0]}>
        <T.SphereGeometry args={[0.035, 8, 8]} />
        <T.MeshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </T.Mesh>
      <!-- Forearm -->
      <T.Mesh position={[0, -0.16, 0.08]} rotation.x={0.6}>
        <T.CylinderGeometry args={[0.028, 0.024, 0.13, 8]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </T.Mesh>
      <!-- Right Hand -->
      <T.Group
        position={[0, -0.22, 0.15]}
        rotation.x={isPlayerVR ? 0.3 : 0.5}
        rotation.y={isPlayerVR ? -0.1 : 0}
      >
        <VRHandModel
          handedness="right"
          color={playerColor}
          trigger={rightTrigger}
          grip={rightGrip}
          thumb={rightThumb}
          scale={0.75}
        />
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- Hidden audio element for playback -->
  {#if playerId !== gameState.userId && isStreamReady}
    <audio bind:this={audioElement} autoplay muted={false} crossorigin="anonymous"></audio>
  {/if}
</T.Mesh>

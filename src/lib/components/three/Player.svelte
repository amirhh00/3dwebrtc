<script lang="ts">
  import { Euler, Vector3 } from 'three';
  import { T, useTask } from '@threlte/core';
  import { RigidBody, CollisionGroups, Collider } from '@threlte/rapier';
  import ThirdPersonControls from './ThirdPersonControls.svelte';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { Group } from 'three';
  import { gameSettings, gameState } from '$lib/store/game.svelte';
  import { HTML } from '@threlte/extras';
  import OtherPlayers from './OtherPlayers.svelte';
  import { socket } from '$lib/store/socket.svelte';
  import PlayerModel from './PlayerModel.svelte';
  import type { RTCData } from '$lib/@types/Rtc.type';
  // import PointerLockControls from './PointerLockControls.svelte';

  type PlayerProps = {
    radius?: number;
    height?: number;
    speed?: number;
  };

  const { radius = 0.3, height = 1.7, speed = 6 }: PlayerProps = $props();

  let position = $state<[number, number, number]>([Math.random() * 10, 3, Math.random() * 5]);
  let capsule = $state<Group>();

  let rigidBody = $state<RapierRigidBody>();

  let forward = $state(0);
  let backward = $state(0);
  let left = $state(0);
  let right = $state(0);

  const temp = new Vector3();

  useTask(() => {
    if (!rigidBody || !capsule) return;
    // get direction
    const velVec = temp.fromArray([0, 0, forward - backward]); // left - right
    // sort rotate and multiply by speed
    velVec.applyEuler(new Euler().copy(capsule.rotation)).multiplyScalar(speed);

    // don't override falling velocity
    const linVel = rigidBody.linvel();
    temp.y = linVel.y;
    // finally set the velocities and wake up the body
    rigidBody.setLinvel(temp, true);

    // when body position changes update camera position
    const pos = rigidBody.translation();
    position = [pos.x, pos.y, pos.z];
    if (socket.webrtc?.dataChannel?.readyState === 'open') {
      socket.webrtc.dataChannel.send(
        JSON.stringify({ type: 'position', from: gameState.userId, position } as RTCData)
      );
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    if (!rigidBody) return;
    const isOnAir = rigidBody.linvel().y > 0.001 || rigidBody.linvel().y < -0.001;
    switch (e.key) {
      case 's':
        backward = isOnAir ? 0.05 : 1;
        break;
      case 'w':
        forward = isOnAir ? 0.05 : 1;
        break;
      case 'a':
        left = isOnAir ? 0.05 : 1;
        break;
      case 'd':
        right = isOnAir ? 0.05 : 1;
        break;
      case ' ':
        if (!isOnAir) rigidBody.setLinvel(new Vector3(0, 7, 0), true);
        break;
      default:
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case 's':
        backward = 0;
        break;
      case 'w':
        forward = 0;
        break;
      case 'a':
        left = 0;
        break;
      case 'd':
        right = 0;
        break;
      default:
        break;
    }
  }
</script>

<svelte:window on:keydown|preventDefault={onKeyDown} on:keyup={onKeyUp} />

{#if capsule}
  <T.PerspectiveCamera makeDefault fov={90}>
    <ThirdPersonControls bind:object={capsule} />
    <!-- <PointerLockControls bind:lock /> -->
  </T.PerspectiveCamera>
{/if}

<T.Group bind:ref={capsule} {position}>
  {#if gameSettings.value.playerName || gameState.userId}
    <HTML
      zIndexRange={[0, 1]}
      center
      pointerEvents="none"
      transform
      position.y={height}
      rotation.y={Math.PI}
    >
      <p class="text-xs">
        {gameSettings.value.playerName || gameState.userId}
      </p>
    </HTML>
  {/if}

  <RigidBody bind:rigidBody enabledRotations={[false, false, false]}>
    <CollisionGroups groups={[0]}>
      <Collider shape={'capsule'} args={[height / 2, radius]} />
      <PlayerModel
        playerId={gameState.userId}
        playerName={gameSettings.value.playerName}
        meshProps={{ position: [0, 0, 0] }}
        playerColor={gameSettings.value.playerColor}
        {height}
        {radius}
      />
    </CollisionGroups>
  </RigidBody>
</T.Group>

{#if gameState?.room?.players && gameState.room.players.length > 1}
  <OtherPlayers {height} {radius} />
{/if}

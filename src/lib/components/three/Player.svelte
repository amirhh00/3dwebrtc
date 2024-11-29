<script lang="ts">
  import { Euler, Vector3 } from 'three';
  import { T, useTask } from '@threlte/core';
  import { RigidBody, CollisionGroups, Collider } from '@threlte/rapier';
  import ThirdPersonControls from './ThirdPersonControls.svelte';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { Group, Mesh } from 'three';
  import { playerInfo, gameState } from '$lib/store/game.svelte';
  import { gameConnection } from '$lib/connections/Game.connection';
  import PlayerModel from './PlayerModel.svelte';
  import { PositionalAudio, AudioListener } from '@threlte/extras';
  // import { onMount } from 'svelte';
  // import PointerLockControls from './PointerLockControls.svelte';

  type PlayerProps = {
    radius?: number;
    height?: number;
    speed?: number;
  };

  const { radius = 0.3, height = 1.7, speed = 6 }: PlayerProps = $props();

  let position = $state<[number, number, number]>([Math.random() * 10, 3, Math.random() * 5]);
  let capsule = $state<Group>();
  let audioListener = $state<AudioListener>();

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
    if (gameConnection.webrtc?.hasDataChannel) {
      gameConnection.webrtc.sendPositionUpdate(pos.x, pos.y, pos.z);
    }
  });

  // onMount(() => {
  //   let clock = new Clock();
  //   let delta = 0;
  //   // 30 fps
  //   let interval = 1 / 30;
  //   /**
  //    * send position update to the host every 30fps
  //    */
  //   function update() {
  //     requestAnimationFrame(update);
  //     delta += clock.getDelta();

  //     if (delta > interval) {
  //       // The draw or time dependent code are here
  //       if (gameConnection.webrtc && rigidBody) {
  //         const x = rigidBody?.translation()?.x;
  //         const y = rigidBody?.translation()?.y;
  //         const z = rigidBody?.translation()?.z;
  //         gameConnection.webrtc.sendPositionUpdate(x, y, z);
  //       }

  //       delta = delta % interval;
  //     }
  //   }

  //   update();
  // });

  function onKeyDown(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;
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

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<T.PerspectiveCamera makeDefault fov={90}>
  {#if capsule}
    <ThirdPersonControls bind:object={capsule} />
  {/if}
  <AudioListener id="al" />
  <!-- <PointerLockControls bind:lock /> -->
</T.PerspectiveCamera>

<T.Group bind:ref={capsule} {position}>
  <RigidBody bind:rigidBody enabledRotations={[false, false, false]}>
    <CollisionGroups groups={[0]}>
      <Collider shape={'capsule'} args={[height / 2, radius]} />
      <PlayerModel
        playerId={gameState.userId}
        playerName={playerInfo.playerName}
        playerColor={playerInfo.playerColor}
        meshProps={{ position: [0, 0, 0] }}
        {height}
        {radius}
      />
    </CollisionGroups>
  </RigidBody>
</T.Group>

{#if gameState?.room?.players && gameState.room.players.length > 1}
  {#each gameState.room.players as player}
    {#if player.id !== gameState.userId}
      <PlayerModel
        playerId={player.id}
        playerName={player.name ?? player.id}
        playerColor={player.color || '#000'}
        {height}
        {radius}
      />
    {/if}
  {/each}
{/if}

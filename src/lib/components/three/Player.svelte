<script lang="ts">
  import { Euler, Vector3 } from 'three';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { RigidBody, CollisionGroups, Collider } from '@threlte/rapier';
  import ThirdPersonControls from './ThirdPersonControls.svelte';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { Group } from 'three';
  import type { PlayerModelProps } from '../../@types/3D.type';
  import { gameSettings, gameState, userId } from '$lib/store/game';
  import { Text, Suspense, HTML } from '@threlte/extras';
  import OtherPlayers from './OtherPlayers.svelte';
  // import PointerLockControls from './PointerLockControls.svelte';

  type PlayerProps = {
    radius?: number;
    height?: number;
    speed?: number;
  };

  const { radius = 0.3, height = 1.7, speed = 6 }: PlayerProps = $props();

  let position = $state<[number, number, number]>([Math.random() * 10, 3, Math.random() * 5]);
  let capsule = $state<Group>();
  let tref = $state<Group>();

  let rigidBody = $state<RapierRigidBody>();

  let forward = $state(0);
  let backward = $state(0);
  let left = $state(0);
  let right = $state(0);
  const { camera } = useThrelte();

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
    if (tref) {
      // always face the player
      tref.lookAt(camera.current.position.x, height, camera.current.position.z);
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

{#snippet PlayerModel({ playerColor = '', playerName = '', meshProps = {} }: PlayerModelProps)}
  <T.Mesh {...meshProps}>
    {#if playerName}
      <T.Group bind:ref={tref}>
        <Suspense>
          <Text
            position.y={height}
            anchorX="center"
            anchorY="center"
            text={playerName}
            characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ"
          />
        </Suspense>
      </T.Group>
      <!-- <HTML
        zIndexRange={[0, 1]}
        center
        pointerEvents="none"
        transform
        position.y={height}
      >
        <p class="text-xs">
          {playerName}
        </p>
      </HTML> -->
    {/if}
    <T.MeshBasicMaterial color={playerColor} />
    <T.CapsuleGeometry args={[radius, height]} />
  </T.Mesh>
{/snippet}

<T.Group bind:ref={capsule} {position}>
  {#if $gameSettings.playerName || $userId}
    <HTML
      zIndexRange={[0, 1]}
      center
      pointerEvents="none"
      transform
      position.y={height}
      rotation.y={Math.PI}
    >
      <p class="text-xs">
        {$gameSettings.playerName || $userId}
      </p>
    </HTML>
  {/if}

  <RigidBody bind:rigidBody enabledRotations={[false, false, false]}>
    <CollisionGroups groups={[0]}>
      <Collider shape={'capsule'} args={[height / 2, radius]} />
      {@render PlayerModel({ playerColor: $gameSettings.playerColor })}
    </CollisionGroups>
  </RigidBody>
</T.Group>

{#if $gameState?.room?.players && $gameState.room.players.length > 1}
  <OtherPlayers {PlayerModel} />
{/if}

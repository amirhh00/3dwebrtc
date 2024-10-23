<script lang="ts">
  import { CapsuleGeometry, Euler, Vector3 } from 'three';
  import { T, useTask } from '@threlte/core';
  import { RigidBody, CollisionGroups, Collider } from '@threlte/rapier';
  import { createEventDispatcher } from 'svelte';
  import Controller from './ThirdPersonControls.svelte';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { Group, Object3D } from 'three';
  import { gameSettings, userId } from '$lib/store/game';
  import { HTML } from '@threlte/extras';
  // import PointerLockControls from './PointerLockControls.svelte';
  export let position = [Math.random() * 10, 3, Math.random() * 5] as [number, number, number];
  export let radius = 0.3;
  export let height = 1.7;
  export let speed = 6;

  let capsule: Group;
  let capRef: Object3D;
  $: if (capsule) {
    capRef = capsule;
  }
  let rigidBody: RapierRigidBody;
  // let lock: () => Promise<void>;

  let forward = 0;
  let backward = 0;
  let left = 0;
  let right = 0;

  let isfalling = false;

  const temp = new Vector3();
  const dispatch = createEventDispatcher();

  let grounded = false;
  $: grounded ? dispatch('groundenter') : dispatch('groundexit');

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
  });

  function onKeyDown(e: KeyboardEvent) {
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

<T.PerspectiveCamera makeDefault fov={90}>
  <Controller bind:object={capRef} />
  <!-- <PointerLockControls bind:lock /> -->
</T.PerspectiveCamera>

<T.Group bind:ref={capsule} {position} rotation.y={Math.PI}>
  {#if $gameSettings.playerName || $userId}
    <HTML zIndexRange={[0, 1]} center pointerEvents="none" transform position.y={0.75}>
      <p>
        {$gameSettings.playerName || $userId}
      </p>
    </HTML>
  {/if}

  <RigidBody bind:rigidBody enabledRotations={[false, false, false]}>
    <CollisionGroups groups={[0]}>
      <Collider shape={'capsule'} args={[height / 2 - radius, radius]} />
      <T.Mesh>
        <T.MeshBasicMaterial color={$gameSettings.playerColor} />
        <T.CapsuleGeometry args={[0.3, 1.8 - 0.3 * 2]} />
      </T.Mesh>
    </CollisionGroups>

    <CollisionGroups groups={[15]}>
      <Collider sensor shape={'ball'} args={[radius * 1.2]} />
    </CollisionGroups>
  </RigidBody>
</T.Group>

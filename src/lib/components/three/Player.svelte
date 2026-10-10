<script lang="ts">
  import { Vector3 } from 'three';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { RigidBody, CollisionGroups, Collider } from '@threlte/rapier';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { Group } from 'three';
  import { playerInfo, gameState } from '$lib/store/game.svelte';
  import { gameConnection } from '$lib/connections/Game.connection';
  import PlayerModel from './PlayerModel.svelte';
  import VRInteractiveController from './VRInteractiveController.svelte';
  import VRInputTracker from './VRInputTracker.svelte';
  import { onMount } from 'svelte';
  import { useXR, XROrigin, Controller, Hand } from '@threlte/xr';

  type PlayerProps = {
    radius?: number;
    height?: number;
    speed?: number;
  };

  const { radius = 0.35, height = 1.6, speed = 4.8 }: PlayerProps = $props();

  let position = $state<[number, number, number]>([0, 1.8, 0]);
  let capsule = $state<Group>();
  let xrOriginRef = $state<Group>();
  let rigidBody = $state<RapierRigidBody>();

  const { camera, renderer } = useThrelte();
  const { isPresenting } = useXR();

  // Desktop look angles
  let yaw = $state(0);
  let pitch = $state(0);
  let isPointerLocked = $state(false);

  // Desktop keyboard movement state
  let forward = $state(0);
  let backward = $state(0);
  let left = $state(0);
  let right = $state(0);
  let isSprinting = $state(false);

  // VR locomotion state
  let vrRotationY = $state(0);
  let snapTurnReady = $state(true);
  let snapTurnCooldown = 0;

  let lastBroadcastTime = 0;

  onMount(() => {
    const dom = renderer.domElement;

    function onPointerLockChange() {
      isPointerLocked = document.pointerLockElement === dom;
    }

    function onMouseMove(e: MouseEvent) {
      if (!isPointerLocked || $isPresenting) return;
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      // Clamp vertical look between -82 and +82 degrees
      pitch = Math.max(-1.43, Math.min(1.43, pitch));
    }

    function onClickCanvas() {
      if (!isPointerLocked && !gameState.isPaused && !$isPresenting) {
        dom.requestPointerLock();
      }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('click', onClickCanvas);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('click', onClickCanvas);
    };
  });

  function getStickAxes(gamepad: Gamepad | undefined): { x: number; y: number } {
    if (!gamepad || !gamepad.axes || gamepad.axes.length === 0) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (gamepad.axes.length >= 4) {
      x = gamepad.axes[2];
      y = gamepad.axes[3];
      // Fallback to touchpad axes if thumbstick is centered
      if (
        Math.abs(x) < 0.1 &&
        Math.abs(y) < 0.1 &&
        (Math.abs(gamepad.axes[0]) > 0.1 || Math.abs(gamepad.axes[1]) > 0.1)
      ) {
        x = gamepad.axes[0];
        y = gamepad.axes[1];
      }
    } else if (gamepad.axes.length >= 2) {
      x = gamepad.axes[0];
      y = gamepad.axes[1];
    }
    // Apply deadzone
    if (Math.abs(x) < 0.15) x = 0;
    if (Math.abs(y) < 0.15) y = 0;
    return { x, y };
  }

  function onKeyDown(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (!rigidBody) return;

    const key = e.key.toLowerCase();
    switch (key) {
      case 'w':
        forward = 1;
        break;
      case 's':
        backward = 1;
        break;
      case 'a':
        left = 1;
        break;
      case 'd':
        right = 1;
        break;
      case 'shift':
        isSprinting = true;
        break;
      case ' ': {
        // Jump only if grounded
        const linVel = rigidBody.linvel();
        if (Math.abs(linVel.y) < 0.12) {
          rigidBody.setLinvel(new Vector3(linVel.x, 6.2, linVel.z), true);
        }
        break;
      }
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    switch (key) {
      case 'w':
        forward = 0;
        break;
      case 's':
        backward = 0;
        break;
      case 'a':
        left = 0;
        break;
      case 'd':
        right = 0;
        break;
      case 'shift':
        isSprinting = false;
        break;
    }
  }

  useTask((delta) => {
    if (!rigidBody) return;

    const pos = rigidBody.translation();
    position = [pos.x, pos.y, pos.z];

    const inVR = $isPresenting || Boolean(renderer.xr?.isPresenting);

    let targetVelX = 0;
    let targetVelZ = 0;

    if (inVR) {
      // VR CONTROLLER INPUT HANDLING
      const session = renderer.xr.getSession();
      let leftPad: Gamepad | undefined;
      let rightPad: Gamepad | undefined;

      if (session) {
        for (const src of session.inputSources) {
          if (src.handedness === 'left') leftPad = src.gamepad;
          if (src.handedness === 'right') rightPad = src.gamepad;
        }
      }

      const lStick = getStickAxes(leftPad);
      const rStick = getStickAxes(rightPad);

      // Right stick snap turning (eliminates motion sickness)
      if (snapTurnCooldown > 0) {
        snapTurnCooldown -= delta;
      }

      if (Math.abs(rStick.x) < 0.2) {
        snapTurnReady = true;
      } else if (snapTurnReady && snapTurnCooldown <= 0) {
        if (rStick.x > 0.55) {
          // Snap turn right 45 degrees
          vrRotationY -= Math.PI / 4;
          snapTurnReady = false;
          snapTurnCooldown = 0.28;
        } else if (rStick.x < -0.55) {
          // Snap turn left 45 degrees
          vrRotationY += Math.PI / 4;
          snapTurnReady = false;
          snapTurnCooldown = 0.28;
        }
      }

      // Locomotion relative to headset look direction (pure 2D ground projection, invariant to yaw)
      const xrCam = renderer.xr.getCamera();
      const lookDir = new Vector3();
      xrCam.getWorldDirection(lookDir);

      const forwardDir = new Vector3(lookDir.x, 0, lookDir.z);
      if (forwardDir.lengthSq() > 0.0001) {
        forwardDir.normalize();
      } else {
        forwardDir.set(0, 0, -1);
      }

      // Right vector is perpendicular to forward on XZ plane: (-forwardDir.z, 0, forwardDir.x)
      const rightDir = new Vector3(-forwardDir.z, 0, forwardDir.x);

      // Stick input (-Y is forward on stick, +X is right)
      const stickFwd = -lStick.y;
      const stickRight = lStick.x;

      // Keyboard input fallback
      const kbFwd = forward - backward;
      const kbRight = right - left;

      const hasStick = Math.hypot(stickFwd, stickRight) > 0.1;
      const inFwd = hasStick ? stickFwd : kbFwd;
      const inRight = hasStick ? stickRight : kbRight;

      const moveVec = new Vector3(
        forwardDir.x * inFwd + rightDir.x * inRight,
        0,
        forwardDir.z * inFwd + rightDir.z * inRight
      );
      const mag = moveVec.length();
      if (mag > 1) {
        moveVec.divideScalar(mag);
      }

      // Comfortable VR walking speed (2.4 m/s walk, 3.6 m/s sprint)
      const vrSpeed = isSprinting ? 3.6 : 2.4;
      targetVelX = moveVec.x * vrSpeed;
      targetVelZ = moveVec.z * vrSpeed;

      // VR Jump (A/X face button only — grip is reserved for grabbing)
      const vrJumpPressed =
        (leftPad?.buttons?.[4]?.pressed ?? false) ||
        (rightPad?.buttons?.[4]?.pressed ?? false);
      const linVel = rigidBody.linvel();
      if (vrJumpPressed && Math.abs(linVel.y) < 0.12) {
        rigidBody.setLinvel(new Vector3(linVel.x, 6.2, linVel.z), true);
      }
    } else {
      // DESKTOP FIRST PERSON CONTROLS
      if (camera.current) {
        const camY = pos.y + height * 0.45;
        camera.current.position.set(pos.x, camY, pos.z);
        camera.current.rotation.set(pitch, yaw, 0, 'YXZ');
      }

      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      let moveX = (forward - backward) * forwardX + (right - left) * rightX;
      let moveZ = (forward - backward) * forwardZ + (right - left) * rightZ;

      const len = Math.hypot(moveX, moveZ);
      if (len > 0.001) {
        moveX /= len;
        moveZ /= len;
      }

      const currentSpeed = isSprinting ? speed * 1.55 : speed;
      targetVelX = moveX * currentSpeed;
      targetVelZ = moveZ * currentSpeed;
    }

    // Preserve vertical physics/gravity velocity
    const linVel = rigidBody.linvel();
    rigidBody.setLinvel(new Vector3(targetVelX, linVel.y, targetVelZ), true);

    // Broadcast position over WebRTC data channel throttled at ~25 Hz
    const now = Date.now();
    if (now - lastBroadcastTime > 40 && gameConnection.webrtc?.hasDataChannel) {
      lastBroadcastTime = now;
      gameConnection.webrtc.sendPositionUpdate(pos.x, pos.y, pos.z, { isVR: inVR });
    }
  });
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<!-- Desktop Camera (active outside VR) -->
{#if !$isPresenting}
  <T.PerspectiveCamera makeDefault fov={85} near={0.1} far={300} />
{/if}

<!-- WebXR Roomscale Origin (anchors VR player in the arena) -->
{#if $isPresenting}
  <XROrigin
    bind:ref={xrOriginRef}
    position={[position[0], 0.5, position[2]]}
    rotation.y={vrRotationY}
  >
    <Controller left>
      <VRInteractiveController handedness="left" />
    </Controller>
    <Controller right>
      <VRInteractiveController handedness="right" />
    </Controller>
    <Hand left />
    <Hand right />
  </XROrigin>
  <VRInputTracker origin={xrOriginRef} />
{/if}

<!-- Player physics body -->
<T.Group bind:ref={capsule} {position}>
  <RigidBody
    bind:rigidBody
    enabledRotations={[false, false, false]}
    linearDamping={0.4}
  >
    <CollisionGroups groups={[0]}>
      <Collider shape={'capsule'} args={[height / 2, radius]} />
    </CollisionGroups>
  </RigidBody>
</T.Group>

<!-- Remote players rendered in real-time via WebRTC -->
{#if gameState?.room?.players && gameState.room.players.length > 1}
  {#each gameState.room.players as player (player.id)}
    {#if player.id !== gameState.userId}
      <PlayerModel
        playerId={player.id}
        playerName={player.name ?? player.id}
        playerColor={player.color || '#0284c7'}
        {height}
        {radius}
      />
    {/if}
  {/each}
{/if}

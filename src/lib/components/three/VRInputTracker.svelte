<!--
  VRInputTracker
  Reads every XR input source directly from the WebXR frame each tick and publishes
  world-space hand / controller data into `vrHands`.

  Why not useController()? SteamVR + Chrome expose the controllers as skeletal *hands*
  when 'hand-tracking' is enabled, so @threlte/xr classifies them as hands and
  useController() returns undefined. Reading the frame directly works for both.
-->
<script lang="ts">
  import { Matrix4, Vector3, Quaternion, type Group, type Mesh } from 'three';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { vrHands, type VRHandData } from '$lib/store/vrHands.svelte';

  interface Props {
    origin: Group | undefined;
  }

  const { origin }: Props = $props();
  const { renderer } = useThrelte();

  // Debug cursors so the player can see where interaction is registered
  let leftTip = $state<Mesh>();
  let rightTip = $state<Mesh>();

  const tmpMat = new Matrix4();
  const tmpWorld = new Matrix4();
  const tmpScale = new Vector3();

  function poseToWorld(matrixArray: Float32Array, outPos: Vector3, outQuat?: Quaternion) {
    tmpMat.fromArray(matrixArray);
    if (origin) {
      tmpWorld.multiplyMatrices(origin.matrixWorld, tmpMat);
    } else {
      tmpWorld.copy(tmpMat);
    }
    const q = outQuat ?? new Quaternion();
    tmpWorld.decompose(outPos, q, tmpScale);
  }

  function readButtons(gp: Gamepad | null | undefined) {
    if (!gp) return { trigger: 0, grip: 0 };
    const b0 = gp.buttons[0];
    const b1 = gp.buttons[1];
    return {
      trigger: b0 ? (b0.value || (b0.pressed ? 1 : 0)) : 0,
      grip: b1 ? (b1.value || (b1.pressed ? 1 : 0)) : 0
    };
  }

  function markDisconnected(h: VRHandData) {
    h.connected = false;
    h.mode = 'none';
    h.isGrabbing = false;
    h.gamepad = null;
  }

  useTask(() => {
    const frame = renderer.xr.getFrame?.();
    const refSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!renderer.xr.isPresenting || !frame || !refSpace || !session) {
      markDisconnected(vrHands.left);
      markDisconnected(vrHands.right);
      if (leftTip) leftTip.visible = false;
      if (rightTip) rightTip.visible = false;
      return;
    }

    origin?.updateWorldMatrix(true, false);

    const seen = { left: false, right: false };

    for (const src of session.inputSources) {
      if (src.handedness !== 'left' && src.handedness !== 'right') continue;
      const h = vrHands[src.handedness];
      const { trigger, grip } = readButtons(src.gamepad);

      if (src.hand) {
        // ---------------- SKELETAL HAND TRACKING ----------------
        const getJoint = (name: XRHandJoint, outPos: Vector3, outQuat?: Quaternion) => {
          const space = src.hand!.get(name);
          if (!space) return false;
          const pose = frame.getJointPose?.(space, refSpace);
          if (!pose) return false;
          poseToWorld(pose.transform.matrix, outPos, outQuat);
          return true;
        };

        const wrist = new Vector3();
        const wristQuat = new Quaternion();
        const palm = new Vector3();
        const indexTip = new Vector3();
        const thumbTip = new Vector3();
        const middleTip = new Vector3();

        const ok =
          getJoint('wrist', wrist, wristQuat) &&
          getJoint('index-finger-tip', indexTip) &&
          getJoint('thumb-tip', thumbTip);
        if (!ok) continue;

        if (!getJoint('middle-finger-metacarpal', palm)) palm.copy(wrist);
        if (!getJoint('middle-finger-tip', middleTip)) middleTip.copy(indexTip);

        const pinchDist = indexTip.distanceTo(thumbTip);
        const fistDist = middleTip.distanceTo(wrist);
        const isPinching = pinchDist < 0.035;
        const isFist = fistDist < 0.1;

        h.mode = 'hand';
        h.position.copy(palm);
        h.quaternion.copy(wristQuat);
        h.forward.subVectors(indexTip, wrist).normalize();
        h.fingertipPos.copy(indexTip);
        h.grabPos.copy(isPinching ? indexTip.clone().add(thumbTip).multiplyScalar(0.5) : palm);
        h.grip = Math.max(grip, isFist ? 1 : 0);
        h.trigger = Math.max(trigger, isPinching ? 1 : 0);
        h.isGrabbing = h.grip > 0.5 || h.trigger > 0.5;
      } else {
        // ---------------- TRACKED CONTROLLER ----------------
        const space = src.gripSpace ?? src.targetRaySpace;
        const pose = frame.getPose(space, refSpace);
        if (!pose) continue;

        const gripPos = new Vector3();
        const gripQuat = new Quaternion();
        poseToWorld(pose.transform.matrix, gripPos, gripQuat);

        const forward = new Vector3(0, 0, -1).applyQuaternion(gripQuat);
        const down = new Vector3(0, -1, 0).applyQuaternion(gripQuat);

        h.mode = 'controller';
        h.position.copy(gripPos);
        h.quaternion.copy(gripQuat);
        h.forward.copy(forward);
        h.fingertipPos.copy(gripPos).addScaledVector(forward, 0.09).addScaledVector(down, 0.01);
        h.grabPos.copy(gripPos).addScaledVector(forward, 0.04);
        h.grip = grip;
        h.trigger = trigger;
        h.isGrabbing = grip > 0.4 || trigger > 0.5;
      }

      // Pointing ray (works for both modes)
      const rayPose = frame.getPose(src.targetRaySpace, refSpace);
      if (rayPose) {
        const rq = new Quaternion();
        poseToWorld(rayPose.transform.matrix, h.rayOrigin, rq);
        h.rayDir.set(0, 0, -1).applyQuaternion(rq);
      } else {
        h.rayOrigin.copy(h.position);
        h.rayDir.copy(h.forward);
      }

      h.gamepad = src.gamepad ?? null;
      h.connected = true;
      seen[src.handedness] = true;
    }

    if (!seen.left) markDisconnected(vrHands.left);
    if (!seen.right) markDisconnected(vrHands.right);

    // Update fingertip debug cursors
    if (leftTip) {
      leftTip.visible = vrHands.left.connected;
      leftTip.position.copy(vrHands.left.fingertipPos);
    }
    if (rightTip) {
      rightTip.visible = vrHands.right.connected;
      rightTip.position.copy(vrHands.right.fingertipPos);
    }
  });
</script>

<!-- Fingertip touch cursors (world space, rendered at scene root) -->
<T.Mesh bind:ref={leftTip} visible={false} renderOrder={999}>
  <T.SphereGeometry args={[0.012, 12, 12]} />
  <T.MeshBasicMaterial color="#22d3ee" depthTest={false} transparent opacity={0.9} />
</T.Mesh>
<T.Mesh bind:ref={rightTip} visible={false} renderOrder={999}>
  <T.SphereGeometry args={[0.012, 12, 12]} />
  <T.MeshBasicMaterial color="#f472b6" depthTest={false} transparent opacity={0.9} />
</T.Mesh>

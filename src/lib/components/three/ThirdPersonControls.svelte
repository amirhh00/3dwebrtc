<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Camera, Vector2, Vector3, Quaternion, Euler, type QuaternionLike } from 'three';
  import { useThrelte, useParent, useTask } from '@threlte/core';
  import type { Object3D } from 'three';

  type TPCProps = {
    object: Object3D;
    rotateSpeed?: number;
    idealOffset?: { x: number; y: number; z: number };
    idealLookAt?: { x: number; y: number; z: number };
  };

  const {
    object = $bindable(),
    rotateSpeed = 1.0,
    idealOffset = { x: 0, y: 2, z: -3 },
    idealLookAt = { x: 0, y: 1, z: 5 }
  }: TPCProps = $props();

  const currentPosition = new Vector3();
  const currentLookAt = new Vector3();

  let isPointerLocked = $state(false);

  const axis = new Vector3(0, 1, 0);
  const rotationQuat = new Quaternion();
  const euler = new Euler(0, 0, 0, 'YXZ');
  const _PI_2 = Math.PI / 2;

  const { renderer, invalidate } = useThrelte();

  const domElement = renderer.domElement;
  const camera = useParent();

  const isCamera = (p: any): p is Camera => {
    return p.isCamera;
  };

  if (!isCamera($camera)) {
    throw new Error('Parent missing: <ThirdPersonControls> need to be a child of a <Camera>');
  }

  domElement.addEventListener('click', () => {
    domElement.requestPointerLock({
      unadjustedMovement: true
    });
  });
  
  domElement.addEventListener('mousemove', onMouseMove);
  domElement.ownerDocument.addEventListener('pointerlockchange', onPointerlockChange);

  onDestroy(() => {
    domElement.removeEventListener('mousemove', onMouseMove);
    domElement.ownerDocument.removeEventListener('pointerlockchange', onPointerlockChange);
  });

  function onMouseMove(event: MouseEvent) {
    if (!isPointerLocked || !object) return;

    const { movementX, movementY } = event;
    
    // Rotate character with mouse movement
    euler.setFromQuaternion(object.quaternion);
    euler.y -= movementX * 0.002 * rotateSpeed;
    euler.x += movementY * 0.002 * rotateSpeed;
    
    // Clamp pitch
    euler.x = Math.max(_PI_2 - Math.PI, Math.min(_PI_2, euler.x));
    
    object.quaternion.setFromEuler(euler);

    invalidate();
  }

  function onPointerlockChange() {
    isPointerLocked = document.pointerLockElement === domElement;
  }

  // This is basically your update function
  useTask((delta) => {
    // the object's position is bound to the prop
    if (!object) return;

    // then we calculate our ideal's
    const offset = vectorFromObject(idealOffset);
    const lookAt = vectorFromObject(idealLookAt);

    // and how far we should move towards them
    const t = 1.0 - Math.pow(0.001, delta);
    currentPosition.lerp(offset, t);
    currentLookAt.lerp(lookAt, t);

    // then finally set the camera
    $camera.position.copy(currentPosition);
    $camera.lookAt(currentLookAt);
  });

  function vectorFromObject(vec: { x: number; y: number; z: number }) {
    const { x, y, z } = vec;
    const ideal = new Vector3(x, y, z);
    ideal.applyQuaternion(object.quaternion);
    ideal.add(new Vector3(object.position.x, object.position.y, object.position.z));
    return ideal;
  }
</script>

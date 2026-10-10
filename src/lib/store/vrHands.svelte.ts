import { Vector3, Quaternion } from 'three';

export interface VRHandData {
  connected: boolean;
  /** 'hand' = skeletal hand tracking, 'controller' = classic tracked controller */
  mode: 'hand' | 'controller' | 'none';
  /** Palm / grip center in world space */
  position: Vector3;
  quaternion: Quaternion;
  forward: Vector3;
  /** Index fingertip (real joint for hands, estimated for controllers) */
  fingertipPos: Vector3;
  /** Point where objects attach when grabbed */
  grabPos: Vector3;
  /** Pointing ray in world space */
  rayOrigin: Vector3;
  rayDir: Vector3;
  grip: number;
  trigger: number;
  isGrabbing: boolean;
  gamepad: Gamepad | null;
}

function createDefaultHand(): VRHandData {
  return {
    connected: false,
    mode: 'none',
    position: new Vector3(),
    quaternion: new Quaternion(),
    forward: new Vector3(0, 0, -1),
    fingertipPos: new Vector3(),
    grabPos: new Vector3(),
    rayOrigin: new Vector3(),
    rayDir: new Vector3(0, 0, -1),
    grip: 0,
    trigger: 0,
    isGrabbing: false,
    gamepad: null
  };
}

// Plain (non-reactive) object: written every frame by VRInputTracker, read every frame by interactables.
export const vrHands: Record<'left' | 'right', VRHandData> = {
  left: createDefaultHand(),
  right: createDefaultHand()
};

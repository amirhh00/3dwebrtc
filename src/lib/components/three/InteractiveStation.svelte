<script lang="ts">
  import { Vector3, Quaternion } from 'three';
  import { T, useTask } from '@threlte/core';
  import { AutoColliders, CollisionGroups } from '@threlte/rapier';
  import { RigidBodyType, type RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import { Text } from '@threlte/extras';
  import {
    interactiveWorld,
    spawnBlocks,
    spawnBalls,
    toggleGravity,
    toggleDisco,
    clearSpawnedItems
  } from '$lib/store/interactiveWorld.svelte';
  import { playButtonClick } from '$lib/audio/gameAudio';
  import { vrHands, type VRHandData } from '$lib/store/vrHands.svelte';
  import InteractiveProp from './InteractiveProp.svelte';

  type Hand = 'left' | 'right';
  const HANDS: Hand[] = ['left', 'right'];

  // ------------------------------------------------------------------
  // Layout (keep in sync with interactiveWorld.svelte.ts)
  // ------------------------------------------------------------------
  const TABLE = { x: 0, y: 0.5, z: -0.62 }; // group origin (floor top is y = 0.5)
  const TABLE_W = 1.4;
  const TABLE_D = 0.56;
  const TOP_Y = 0.88; // local centre of the tabletop slab
  const TOP_T = 0.06; // slab thickness
  const SURFACE = TOP_Y + TOP_T / 2; // local surface height (world 1.41)

  const BTN_Z = 0.18; // local z of button strip (world -0.44, nearest to player)
  const RAIL_Z = 0.08; // divider rail between buttons and props tray
  const RAIL_H = 0.05;

  const PLUNGER_UP = 0.035;
  const PLUNGER_DOWN = 0.018;
  const PLUNGER_H = 0.025;

  const buttons = [
    { id: 0, x: -0.44, label: '+ CUBES', action: spawnBlocks },
    { id: 1, x: -0.22, label: '+ BALLS', action: spawnBalls },
    { id: 2, x: 0.0, label: 'GRAVITY', action: toggleGravity },
    { id: 3, x: 0.22, label: 'DISCO', action: toggleDisco },
    { id: 4, x: 0.44, label: 'RESET', action: clearSpawnedItems }
  ];

  // World-space centre of each plunger's top face
  const buttonTops = buttons.map(
    (b) => new Vector3(TABLE.x + b.x, TABLE.y + SURFACE + PLUNGER_UP + PLUNGER_H / 2, TABLE.z + BTN_Z)
  );

  // ------------------------------------------------------------------
  // Button state
  // ------------------------------------------------------------------
  let activeBtn = $state<number | null>(null);
  let hoveredBtn = $state<number | null>(null);
  const btnArmed = buttons.map(() => true); // edge-trigger: one press per poke

  function pressButton(index: number, action: () => void, hand?: VRHandData) {
    activeBtn = index;
    playButtonClick();
    action();
    pulse(hand, 0.9, 45);
    setTimeout(() => {
      if (activeBtn === index) activeBtn = null;
    }, 200);
  }

  function pulse(hand: VRHandData | undefined, intensity: number, ms: number) {
    const act = hand?.gamepad?.hapticActuators?.[0];
    if (!act) return;
    try {
      void act.pulse(intensity, ms);
    } catch {
      /* haptics unsupported */
    }
  }

  function buttonColor(id: number) {
    switch (id) {
      case 0:
        return '#06b6d4';
      case 1:
        return '#22c55e';
      case 2:
        return interactiveWorld.isLowGravity ? '#eab308' : '#64748b';
      case 3:
        return interactiveWorld.isDiscoMode ? '#ec4899' : '#a855f7';
      default:
        return '#f43f5e';
    }
  }

  function buttonLabel(id: number, fallback: string) {
    if (id === 2) return interactiveWorld.isLowGravity ? 'MOON G' : '1G';
    if (id === 3) return interactiveWorld.isDiscoMode ? 'DISCO ON' : 'DISCO';
    return fallback;
  }

  // ------------------------------------------------------------------
  // Physics prop registry
  // ------------------------------------------------------------------
  const propBodies = new Map<string, RapierRigidBody>();
  const onMountBody = (id: string, body: RapierRigidBody) => propBodies.set(id, body);
  const onDestroyBody = (id: string) => {
    propBodies.delete(id);
    for (const h of HANDS) if (grab[h].id === id) grab[h].id = null;
  };

  // ------------------------------------------------------------------
  // Grab state per hand
  // ------------------------------------------------------------------
  interface GrabState {
    id: string | null;
    localPos: Vector3; // object offset in hand space
    localRot: Quaternion; // object rotation in hand space
    prevPos: Vector3;
    vel: Vector3;
    prevGrabbing: boolean;
    prevTrigger: number;
  }
  const mkGrab = (): GrabState => ({
    id: null,
    localPos: new Vector3(),
    localRot: new Quaternion(),
    prevPos: new Vector3(),
    vel: new Vector3(),
    prevGrabbing: false,
    prevTrigger: 0
  });
  const grab: Record<Hand, GrabState> = { left: mkGrab(), right: mkGrab() };

  let hoveredPropIds = $state<Set<string>>(new Set());
  let hoverKey = '';

  const PICKUP_RADIUS = 0.13;
  const tmpV = new Vector3();
  const tmpQ = new Quaternion();
  const tmpInv = new Quaternion();

  function releaseHand(h: Hand, hand: VRHandData, throwIt: boolean) {
    const g = grab[h];
    if (!g.id) return;
    const body = propBodies.get(g.id);
    if (body) {
      body.setBodyType(RigidBodyType.Dynamic, true);
      if (throwIt) {
        const v = g.vel.clone().multiplyScalar(1.2);
        if (v.length() > 12) v.setLength(12);
        body.setLinvel(v, true);
      }
      body.wakeUp();
    }
    pulse(hand, 0.3, 20);
    g.id = null;
    interactiveWorld.grabbedItemId[h] = null;
  }

  useTask((delta) => {
    const newHover = new Set<string>();
    let hoverBtn: number | null = null;
    const touchingBtn = buttons.map(() => false);

    for (const h of HANDS) {
      const hand = vrHands[h];
      const g = grab[h];

      if (!hand.connected) {
        if (g.id) releaseHand(h, hand, false);
        g.prevGrabbing = false;
        continue;
      }

      // ---- hand velocity (for throwing) ----
      if (g.prevPos.lengthSq() > 0 && delta > 0) {
        tmpV.subVectors(hand.grabPos, g.prevPos).divideScalar(delta);
        g.vel.lerp(tmpV, 0.4);
      }
      g.prevPos.copy(hand.grabPos);

      // ==============================================================
      // 1. BUTTONS — poke with fingertip (or controller tip)
      // ==============================================================
      const probes = hand.mode === 'controller' ? [hand.fingertipPos, hand.grabPos] : [hand.fingertipPos];

      for (let i = 0; i < buttons.length; i++) {
        const top = buttonTops[i];
        for (const p of probes) {
          const dxz = Math.hypot(p.x - top.x, p.z - top.z);
          const dy = p.y - top.y;
          if (dxz < 0.11 && dy < 0.12 && dy > -0.08) hoverBtn = i;
          // "Inside" = finger is over the cap and has pushed down to (or into) it
          if (dxz < 0.085 && dy < 0.015 && dy > -0.07) touchingBtn[i] = true;
        }
      }

      // Ray + trigger click (only when not holding something)
      const triggerDown = hand.trigger > 0.6 && g.prevTrigger <= 0.6;
      if (!g.id) {
        for (let i = 0; i < buttons.length; i++) {
          tmpV.subVectors(buttonTops[i], hand.rayOrigin);
          const along = tmpV.dot(hand.rayDir);
          if (along <= 0.05 || along > 3) continue;
          const perp = tmpV.addScaledVector(hand.rayDir, -along).length();
          if (perp < 0.07) {
            hoverBtn = i;
            if (triggerDown && hand.mode === 'controller') pressButton(i, buttons[i].action, hand);
          }
        }
      }
      g.prevTrigger = hand.trigger;

      // ==============================================================
      // 2. GRAB / HOLD / THROW
      // ==============================================================
      const grabStart = hand.isGrabbing && !g.prevGrabbing;
      g.prevGrabbing = hand.isGrabbing;

      if (g.id) {
        const body = propBodies.get(g.id);
        if (!body) {
          g.id = null;
          interactiveWorld.grabbedItemId[h] = null;
        } else if (hand.isGrabbing) {
          // Follow hand position + rotation, keeping the original grab offset
          tmpV.copy(g.localPos).applyQuaternion(hand.quaternion).add(hand.grabPos);
          tmpQ.copy(hand.quaternion).multiply(g.localRot);
          body.setNextKinematicTranslation(tmpV);
          body.setNextKinematicRotation(tmpQ);
        } else {
          releaseHand(h, hand, true);
        }
        continue;
      }

      // Find closest prop to the grab point
      let bestId: string | null = null;
      let bestDist = PICKUP_RADIUS;
      for (const [id, body] of propBodies) {
        const t = body.translation();
        const d = Math.hypot(t.x - hand.grabPos.x, t.y - hand.grabPos.y, t.z - hand.grabPos.z);
        if (d < PICKUP_RADIUS + 0.05) newHover.add(id);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
        }
      }

      if (grabStart && bestId) {
        const body = propBodies.get(bestId)!;

        // Steal from the other hand if needed
        const other: Hand = h === 'left' ? 'right' : 'left';
        if (grab[other].id === bestId) {
          grab[other].id = null;
          interactiveWorld.grabbedItemId[other] = null;
        }

        // Store offset in hand-local space so the object keeps its pose relative to the hand
        const t = body.translation();
        const r = body.rotation();
        tmpInv.copy(hand.quaternion).invert();
        g.localPos.set(t.x, t.y, t.z).sub(hand.grabPos).applyQuaternion(tmpInv);
        g.localRot.copy(tmpInv).multiply(tmpQ.set(r.x, r.y, r.z, r.w));
        g.vel.set(0, 0, 0);

        body.setBodyType(RigidBodyType.KinematicPositionBased, true);
        g.id = bestId;
        interactiveWorld.grabbedItemId[h] = bestId;
        pulse(hand, 0.8, 35);
      }
    }

    // ---- button edge detection (shared between both hands) ----
    for (let i = 0; i < buttons.length; i++) {
      if (touchingBtn[i] && btnArmed[i]) {
        btnArmed[i] = false;
        const presser = HANDS.map((h) => vrHands[h]).find((hd) => hd.connected);
        pressButton(i, buttons[i].action, presser);
      } else if (!touchingBtn[i]) {
        btnArmed[i] = true;
      }
    }

    hoveredBtn = hoverBtn;

    // Only touch reactive state when the hover set actually changes
    const key = [...newHover].sort().join('|');
    if (key !== hoverKey) {
      hoverKey = key;
      hoveredPropIds = newHover;
    }
  });
</script>

<T.Group position={[TABLE.x, TABLE.y, TABLE.z]}>
  <!-- ======================= TABLE ======================= -->
  <CollisionGroups groups={[0]}>
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[0, TOP_Y, 0]}>
        <T.BoxGeometry args={[TABLE_W, TOP_T, TABLE_D]} />
        <T.MeshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
      </T.Mesh>
    </AutoColliders>

    <!-- Divider rail: keeps props out of the button strip -->
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[0, SURFACE + RAIL_H / 2, RAIL_Z]}>
        <T.BoxGeometry args={[TABLE_W, RAIL_H, 0.02]} />
        <T.MeshStandardMaterial color="#1e293b" emissive="#0284c7" emissiveIntensity={0.4} />
      </T.Mesh>
    </AutoColliders>
    <!-- Back rail -->
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[0, SURFACE + RAIL_H / 2, -TABLE_D / 2 + 0.01]}>
        <T.BoxGeometry args={[TABLE_W, RAIL_H, 0.02]} />
        <T.MeshStandardMaterial color="#1e293b" />
      </T.Mesh>
    </AutoColliders>
    <!-- Side rails (tray only) -->
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[-TABLE_W / 2 + 0.01, SURFACE + RAIL_H / 2, (RAIL_Z - TABLE_D / 2) / 2]}>
        <T.BoxGeometry args={[0.02, RAIL_H, RAIL_Z + TABLE_D / 2]} />
        <T.MeshStandardMaterial color="#1e293b" />
      </T.Mesh>
    </AutoColliders>
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[TABLE_W / 2 - 0.01, SURFACE + RAIL_H / 2, (RAIL_Z - TABLE_D / 2) / 2]}>
        <T.BoxGeometry args={[0.02, RAIL_H, RAIL_Z + TABLE_D / 2]} />
        <T.MeshStandardMaterial color="#1e293b" />
      </T.Mesh>
    </AutoColliders>

    <!-- Front neon edge -->
    <T.Mesh position={[0, SURFACE + 0.004, TABLE_D / 2 - 0.005]}>
      <T.BoxGeometry args={[TABLE_W, 0.008, 0.01]} />
      <T.MeshBasicMaterial color={interactiveWorld.isDiscoMode ? '#ec4899' : '#38bdf8'} />
    </T.Mesh>

    <!-- Legs -->
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[-0.6, TOP_Y / 2, 0]}>
        <T.BoxGeometry args={[0.06, TOP_Y, 0.06]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
      </T.Mesh>
      <T.Mesh position={[0.6, TOP_Y / 2, 0]}>
        <T.BoxGeometry args={[0.06, TOP_Y, 0.06]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
      </T.Mesh>
    </AutoColliders>
  </CollisionGroups>

  <!-- ======================= BUTTONS ======================= -->
  {#each buttons as btn (btn.id)}
    {@const color = buttonColor(btn.id)}
    {@const pressed = activeBtn === btn.id}
    {@const hovered = hoveredBtn === btn.id}
    <T.Group position={[btn.x, SURFACE, BTN_Z]}>
      <!-- Bezel -->
      <T.Mesh position.y={0.0125}>
        <T.CylinderGeometry args={[0.075, 0.082, 0.025, 24]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.8} />
      </T.Mesh>
      <!-- Plunger -->
      <T.Mesh
        position.y={pressed ? PLUNGER_DOWN : PLUNGER_UP}
        onclick={() => pressButton(btn.id, btn.action)}
      >
        <T.CylinderGeometry args={[0.062, 0.062, PLUNGER_H, 24]} />
        <T.MeshStandardMaterial
          {color}
          emissive={color}
          emissiveIntensity={pressed ? 2.0 : hovered ? 1.2 : 0.5}
          roughness={0.25}
        />
      </T.Mesh>
      <!-- Label on the front lip, tilted toward the player -->
      <Text
        text={buttonLabel(btn.id, btn.label)}
        fontSize={0.026}
        color={color}
        anchorX="center"
        anchorY="middle"
        position={[0, 0.003, 0.09]}
        rotation.x={-Math.PI / 2}
      />
    </T.Group>
  {/each}
</T.Group>

<!-- ======================= PROPS ======================= -->
{#each interactiveWorld.items as item (item.id)}
  <InteractiveProp
    {item}
    isGrabbed={interactiveWorld.grabbedItemId.left === item.id ||
      interactiveWorld.grabbedItemId.right === item.id}
    isHovered={hoveredPropIds.has(item.id)}
    {onMountBody}
    {onDestroyBody}
  />
{/each}

<script lang="ts">
  import { T } from '@threlte/core';
  import { CollisionGroups, RigidBody, Collider } from '@threlte/rapier';
  import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
  import type { InteractiveItem } from '$lib/store/interactiveWorld.svelte';
  import { interactiveWorld } from '$lib/store/interactiveWorld.svelte';
  import { onDestroy } from 'svelte';

  interface Props {
    item: InteractiveItem;
    isGrabbed: boolean;
    isHovered: boolean;
    onMountBody: (id: string, body: RapierRigidBody) => void;
    onDestroyBody: (id: string) => void;
  }

  const { item, isGrabbed, isHovered, onMountBody, onDestroyBody }: Props = $props();

  let rigidBody = $state<RapierRigidBody>();

  $effect(() => {
    if (rigidBody) {
      onMountBody(item.id, rigidBody);
    }
  });

  onDestroy(() => {
    onDestroyBody(item.id);
  });
</script>

<CollisionGroups groups={[0]}>
  {#if item.type === 'box'}
    <T.Group position={[item.x, item.y, item.z]}>
      <RigidBody
        bind:rigidBody
        linearDamping={0.25}
        angularDamping={0.25}
        gravityScale={interactiveWorld.isLowGravity ? 0.18 : 1.0}
      >
        <Collider
          shape={'cuboid'}
          args={[
            (item.size?.[0] ?? 0.15) / 2,
            (item.size?.[1] ?? 0.15) / 2,
            (item.size?.[2] ?? 0.15) / 2
          ]}
          friction={0.6}
          restitution={0.3}
        />
        <T.Mesh>
          <T.BoxGeometry args={item.size ?? [0.15, 0.15, 0.15]} />
          <T.MeshStandardMaterial
            color={item.color}
            metalness={0.35}
            roughness={0.3}
            emissive={item.color}
            emissiveIntensity={isGrabbed ? 1.0 : isHovered ? 0.55 : 0.18}
          />
        </T.Mesh>
      </RigidBody>
    </T.Group>
  {:else if item.type === 'ball'}
    <T.Group position={[item.x, item.y, item.z]}>
      <RigidBody
        bind:rigidBody
        linearDamping={0.15}
        angularDamping={0.15}
        gravityScale={interactiveWorld.isLowGravity ? 0.18 : 1.0}
      >
        <Collider
          shape={'ball'}
          args={[item.radius ?? 0.1]}
          restitution={0.88}
          friction={0.3}
        />
        <T.Mesh>
          <T.SphereGeometry args={[item.radius ?? 0.1, 20, 20]} />
          <T.MeshStandardMaterial
            color={item.color}
            metalness={0.5}
            roughness={0.2}
            emissive={item.color}
            emissiveIntensity={isGrabbed ? 1.1 : isHovered ? 0.6 : 0.22}
          />
        </T.Mesh>
      </RigidBody>
    </T.Group>
  {:else if item.type === 'baton'}
    <T.Group position={[item.x, item.y, item.z]}>
      <RigidBody
        bind:rigidBody
        linearDamping={0.35}
        angularDamping={0.35}
        gravityScale={interactiveWorld.isLowGravity ? 0.18 : 1.0}
      >
        <Collider shape={'cuboid'} args={[0.03, 0.22, 0.03]} friction={0.7} restitution={0.4} />
        <!-- Baton Handle -->
        <T.Mesh position={[0, -0.06, 0]}>
          <T.CylinderGeometry args={[0.02, 0.02, 0.18, 16]} />
          <T.MeshStandardMaterial color="#0f172a" roughness={0.8} />
        </T.Mesh>
        <!-- Baton Glowing Energy Head -->
        <T.Mesh position={[0, 0.1, 0]}>
          <T.CylinderGeometry args={[0.028, 0.028, 0.18, 16]} />
          <T.MeshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={isGrabbed ? 1.8 : isHovered ? 1.3 : 0.9}
            metalness={0.4}
          />
        </T.Mesh>
      </RigidBody>
    </T.Group>
  {/if}
</CollisionGroups>

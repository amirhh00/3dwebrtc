<script>
  import { T } from '@threlte/core';
  import { AutoColliders, CollisionGroups, Debug } from '@threlte/rapier';
  import { BoxGeometry, MeshStandardMaterial } from 'three';
  import Player from './Player.svelte';
  import { dev } from '$app/environment';
  import { gameState } from '$lib/store/game.svelte';
</script>

<T.DirectionalLight castShadow position={[8, 20, -3]} />
<T.AmbientLight intensity={0.2} />

{#if dev}
  <Debug />
{/if}

{#if gameState.room.roomId}
  <CollisionGroups groups={[0, 15]}>
    <AutoColliders shape={'cuboid'}>
      <T.Mesh
        receiveShadow
        geometry={new BoxGeometry(100, 1, 100)}
        material={new MeshStandardMaterial()}
      />
    </AutoColliders>
  </CollisionGroups>

  <CollisionGroups groups={[0]}>
    <Player />
    <!-- WALLS -->
    <AutoColliders shape={'cuboid'}>
      <T.Mesh
        receiveShadow
        castShadow
        position.x={30 + 0.7 + 0.15}
        position.y={1.275}
        geometry={new BoxGeometry(60, 2.55, 0.15)}
        material={new MeshStandardMaterial({
          transparent: true,
          opacity: 0.5,
          color: 0x333333
        })}
      />
      <T.Mesh
        receiveShadow
        castShadow
        position.x={-30 - 0.7 - 0.15}
        position.y={1.275}
        geometry={new BoxGeometry(60, 2.55, 0.15)}
        material={new MeshStandardMaterial({
          transparent: true,
          opacity: 0.5,
          color: 0x333333
        })}
      />
    </AutoColliders>
  </CollisionGroups>
{/if}

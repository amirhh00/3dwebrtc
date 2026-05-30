<script lang="ts">
  import { T } from '@threlte/core';
  import { AutoColliders, CollisionGroups, Debug } from '@threlte/rapier';
  import { BoxGeometry, MeshStandardMaterial, PlaneGeometry, CanvasTexture } from 'three';
  import Player from './Player.svelte';
  import { dev } from '$app/environment';
  import { gameState } from '$lib/store/game.svelte';

  // Create a tiled floor texture
  function createTiledFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const tileSize = 32;
    const colors = ['#4a5568', '#5a6578'];

    for (let y = 0; y < canvas.height; y += tileSize) {
      for (let x = 0; x < canvas.width; x += tileSize) {
        const colorIndex = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(x, y, tileSize, tileSize);
        
        // Add subtle grid lines
        ctx.strokeStyle = '#3a4568';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    return new CanvasTexture(canvas);
  }

  const floorTexture = createTiledFloorTexture();
  const floorMaterial = new MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.8,
    metalness: 0.1
  });
</script>

<T.DirectionalLight castShadow position={[8, 20, -3]} />
<T.AmbientLight intensity={0.4} />

{#if dev}
  <Debug />
{/if}

{#if gameState.room.roomId}
  <CollisionGroups groups={[0, 15]}>
    <AutoColliders shape={'cuboid'}>
      <T.Mesh
        receiveShadow
        geometry={new BoxGeometry(100, 1, 100)}
        material={floorMaterial}
      />
    </AutoColliders>
  </CollisionGroups>

  <CollisionGroups groups={[0]}>
    <Player />
  </CollisionGroups>
{/if}

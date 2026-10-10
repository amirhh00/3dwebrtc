<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { AutoColliders, CollisionGroups, RigidBody, Collider } from '@threlte/rapier';
  import { BoxGeometry, MeshStandardMaterial, CanvasTexture, SphereGeometry } from 'three';
  import Player from './Player.svelte';
  import { Stars, Sparkles, Grid, Float, Text } from '@threlte/extras';
  import { gameState } from '$lib/store/game.svelte';

  // Create a clean tiled arena floor texture
  function createTiledFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const tileSize = 32;
    const colors = ['#0f172a', '#1e293b'];

    for (let y = 0; y < canvas.height; y += tileSize) {
      for (let x = 0; x < canvas.width; x += tileSize) {
        const colorIndex = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = '#334155';
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
    metalness: 0.2
  });

  // Fun interactive arena physics props to kick and play with
  const arenaBalls = [
    { x: 3, z: 3, color: '#38bdf8', radius: 0.5 },
    { x: -3, z: 4, color: '#f43f5e', radius: 0.6 },
    { x: 4, z: -3, color: '#10b981', radius: 0.55 },
    { x: -4, z: -4, color: '#f59e0b', radius: 0.5 },
    { x: 0, z: 6, color: '#a855f7', radius: 0.7 }
  ];

  import InteractiveStation from './InteractiveStation.svelte';
  import { interactiveWorld } from '$lib/store/interactiveWorld.svelte';

  // Architectural Pillars in corners
  const pillars = [
    { x: 14, z: 14 },
    { x: -14, z: 14 },
    { x: -14, z: -14 },
    { x: 14, z: -14 }
  ];
</script>

<!-- Atmosphere & High-Performance Lighting -->
<T.FogExp2 color="#040814" density={0.012} />
<Stars count={1200} factor={3.5} radius={75} saturation={0.4} fade />
<Sparkles count={35} scale={[35, 8, 35]} size={2.0} speed={0.2} opacity={0.3} color="#38bdf8" />

<T.DirectionalLight position={[15, 30, 10]} intensity={1.8} color="#f8fafc" />
<T.AmbientLight intensity={0.65} color="#38bdf8" />

<!-- Disco Party Lights when toggled -->
{#if interactiveWorld.isDiscoMode}
  <T.PointLight position={[0, 8, 0]} intensity={4.5} color="#ec4899" distance={35} />
  <T.PointLight position={[-6, 5, -5]} intensity={4.0} color="#06b6d4" distance={30} />
  <T.PointLight position={[6, 5, -5]} intensity={4.0} color="#eab308" distance={30} />
{/if}

<!-- Infinite ground visual grid -->
<Grid
  cellColor="#1e293b"
  sectionColor={interactiveWorld.isDiscoMode ? '#ec4899' : '#0284c7'}
  sectionSize={5}
  cellSize={1}
  infiniteGrid
  fadeDistance={65}
  fadeStrength={1.5}
  position.y={0.51}
/>

<!-- Arena Solid Floor (top is at y = 0.5) -->
<CollisionGroups groups={[0]}>
  <AutoColliders shape={'cuboid'}>
    <T.Mesh position={[0, 0, 0]} geometry={new BoxGeometry(60, 1, 60)} material={floorMaterial} />
  </AutoColliders>
</CollisionGroups>

<!-- Arena Boundary Walls (keeps players inside the arena) -->
<CollisionGroups groups={[0]}>
  <!-- North Wall -->
  <AutoColliders shape={'cuboid'}>
    <T.Mesh position={[0, 1.5, -30]}>
      <T.BoxGeometry args={[60, 2, 0.4]} />
      <T.MeshStandardMaterial color="#0284c7" transparent opacity={0.35} roughness={0.1} />
    </T.Mesh>
  </AutoColliders>
  <!-- South Wall -->
  <AutoColliders shape={'cuboid'}>
    <T.Mesh position={[0, 1.5, 30]}>
      <T.BoxGeometry args={[60, 2, 0.4]} />
      <T.MeshStandardMaterial color="#0284c7" transparent opacity={0.35} roughness={0.1} />
    </T.Mesh>
  </AutoColliders>
  <!-- East Wall -->
  <AutoColliders shape={'cuboid'}>
    <T.Mesh position={[30, 1.5, 0]}>
      <T.BoxGeometry args={[0.4, 2, 60]} />
      <T.MeshStandardMaterial color="#0284c7" transparent opacity={0.35} roughness={0.1} />
    </T.Mesh>
  </AutoColliders>
  <!-- West Wall -->
  <AutoColliders shape={'cuboid'}>
    <T.Mesh position={[-30, 1.5, 0]}>
      <T.BoxGeometry args={[0.4, 2, 60]} />
      <T.MeshStandardMaterial color="#0284c7" transparent opacity={0.35} roughness={0.1} />
    </T.Mesh>
  </AutoColliders>
</CollisionGroups>

<!-- 3D In-World Info Display (Pure 3D WebGL billboard) -->
<T.Group position={[0, 3.4, -6.5]}>
  <!-- Frame Backing -->
  <T.Mesh>
    <T.BoxGeometry args={[3.8, 1.4, 0.08]} />
    <T.MeshStandardMaterial color="#090d16" roughness={0.3} metalness={0.8} />
  </T.Mesh>
  <!-- Glowing Border -->
  <T.Mesh position={[0, 0, 0.042]}>
    <T.BoxGeometry args={[3.76, 1.36, 0.005]} />
    <T.MeshBasicMaterial color="#0284c7" />
  </T.Mesh>
  <!-- Screen Inner -->
  <T.Mesh position={[0, 0, 0.046]}>
    <T.BoxGeometry args={[3.7, 1.3, 0.005]} />
    <T.MeshBasicMaterial color="#030712" />
  </T.Mesh>
  <!-- 3D Texts -->
  <Text
    text="3D WEBRTC MULTIPLAYER ARENA"
    fontSize={0.13}
    color="#38bdf8"
    anchorX="center"
    anchorY="middle"
    position={[0, 0.42, 0.06]}
  />
  <Text
    text={gameState.room.roomId ? `Room: ${gameState.room.roomId.slice(0, 8)}...` : 'Solo 3D Sandbox'}
    fontSize={0.17}
    color={gameState.room.roomId ? '#34d399' : '#38bdf8'}
    anchorX="center"
    anchorY="middle"
    position={[0, 0.16, 0.06]}
  />
  <Text
    text={`${gameState.room.players?.length ?? 1} Player(s) Online`}
    fontSize={0.12}
    color="#94a3b8"
    anchorX="center"
    anchorY="middle"
    position={[0, -0.08, 0.06]}
  />
  <Text
    text="R-Stick: Snap Turn | L-Stick: Walk | Hands: Touch Buttons"
    fontSize={0.082}
    color="#22d3ee"
    anchorX="center"
    anchorY="middle"
    position={[0, -0.34, 0.06]}
  />
</T.Group>

<!-- Interactive Workshop Station & Dynamic Physics Props -->
<InteractiveStation />

<!-- Interactive Physics Props (kickable balls in the arena) -->
{#each arenaBalls as ball, i}
  <CollisionGroups groups={[0]}>
    <T.Group position={[ball.x, 2 + i * 0.5, ball.z]}>
      <RigidBody linearDamping={0.2} angularDamping={0.2} gravityScale={interactiveWorld.isLowGravity ? 0.18 : 1.0}>
        <Collider shape={'ball'} args={[ball.radius]} restitution={0.8} friction={0.4} />
        <T.Mesh>
          <T.SphereGeometry args={[ball.radius, 24, 24]} />
          <T.MeshStandardMaterial color={ball.color} metalness={0.4} roughness={0.2} emissive={ball.color} emissiveIntensity={0.2} />
        </T.Mesh>
      </RigidBody>
    </T.Group>
  </CollisionGroups>
{/each}

<!-- Architectural Pillars in corners -->
{#each pillars as p}
  <CollisionGroups groups={[0]}>
    <AutoColliders shape={'cuboid'}>
      <T.Mesh position={[p.x, 2.5, p.z]}>
        <T.BoxGeometry args={[1.6, 4, 1.6]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </T.Mesh>
      <T.Mesh position={[p.x, 4.6, p.z]}>
        <T.BoxGeometry args={[1.4, 0.1, 1.4]} />
        <T.MeshBasicMaterial color="#38bdf8" />
      </T.Mesh>
    </AutoColliders>
  </CollisionGroups>
{/each}

<!-- Local and Remote Players -->
<CollisionGroups groups={[0]}>
  <Player />
</CollisionGroups>

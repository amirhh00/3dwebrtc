<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { type Mesh, MeshBasicMaterial, Color } from 'three';

  interface HealthBarProps {
    health?: number;
    maxHealth?: number;
    height?: number;
  }

  const { health = 100, maxHealth = 100, height = 2 }: HealthBarProps = $props();

  let bgMesh = $state<Mesh>();
  let healthMesh = $state<Mesh>();

  useTask(() => {
    const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    const healthColor = healthPercent > 50 ? 0x00ff00 : healthPercent > 25 ? 0xffaa00 : 0xff0000;
    
    if (healthMesh && healthMesh.material) {
      // Scale health bar based on percentage
      healthMesh.scale.x = healthPercent / 100;
      healthMesh.position.x = (healthPercent / 100 - 1) * 0.5;
      
      // Update color
      const mat = healthMesh.material as MeshBasicMaterial;
      mat.color.setHex(healthColor);
    }
  });
</script>

<!-- Background bar -->
<T.Mesh bind:ref={bgMesh} position.y={height + 0.3} scale.y={0.1} scale.x={1} scale.z={0.05}>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshBasicMaterial color={0x222222} />
</T.Mesh>

<!-- Health bar -->
<T.Mesh bind:ref={healthMesh} position={[0, height + 0.3, 0.05]} scale.y={0.1} scale.x={1} scale.z={0.05}>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshBasicMaterial color={0x00ff00} />
</T.Mesh>

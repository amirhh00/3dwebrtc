<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { BoxGeometry, MeshBasicMaterial, Vector3, Raycaster, Mesh, BufferGeometry, LineBasicMaterial, Line } from 'three';
  import { gameState, playerInfo } from '$lib/store/game.svelte';
  import { gameConnection } from '$lib/connections/Game.connection';

  let lastShotTime = $state(0);
  let ammo = $state(30);
  let maxAmmo = 30;
  let isReloading = $state(false);
  let reloadProgress = $state(0);
  const FIRE_RATE = 100; // ms between shots
  const RELOAD_TIME = 2000; // ms to reload

  const { camera, scene } = useThrelte();
  const raycaster = new Raycaster();
  const shootDirection = new Vector3();

  // Export state for HUD component
  export { ammo, isReloading, reloadProgress };

  function shoot() {
    // Check if can shoot
    if (ammo <= 0) return;
    if (isReloading) return;
    
    const now = Date.now();
    if (now - lastShotTime < FIRE_RATE) return;
    lastShotTime = now;
    ammo--;

    // Get camera direction
    camera.current.getWorldDirection(shootDirection);

    // Raycast from camera
    raycaster.set(camera.current.position, shootDirection);
    const intersects = raycaster.intersectObjects(scene.children, true);

    let hitPoint: Vector3 | null = null;
    let targetHit = false;

    // Find first hit that's not the player
    for (const intersection of intersects) {
      const obj = intersection.object;
      
      // Skip if it's part of the player's own model
      if (obj.userData?.playerId === gameState.userId) {
        continue;
      }

      // Check if this object belongs to another player
      let targetPlayerId: string | null = null;
      
      if (obj.userData?.playerId) {
        targetPlayerId = obj.userData.playerId;
      } else if (obj.parent?.userData?.playerId) {
        targetPlayerId = obj.parent.userData.playerId;
      }

      if (targetPlayerId && targetPlayerId !== gameState.userId) {
        // Hit a player!
        hitPoint = intersection.point;
        targetHit = true;
        const damage = 25;
        damagePlayer(targetPlayerId, damage);
        break;
      }
    }

    // If no target hit, use a far point
    if (!hitPoint) {
      hitPoint = camera.current.position.clone().addScaledVector(shootDirection, 1000);
    }

    // Create visual effects
    createMuzzleFlash();
    createBulletTrajectory(camera.current.position, hitPoint);
    createImpactPoint(hitPoint);
  }

  function reload() {
    if (isReloading || ammo === maxAmmo) return;
    
    isReloading = true;
    reloadProgress = 0;
    
    const startTime = Date.now();
    const reloadInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      reloadProgress = Math.min(100, (elapsed / RELOAD_TIME) * 100);
      
      if (elapsed >= RELOAD_TIME) {
        clearInterval(reloadInterval);
        ammo = maxAmmo;
        isReloading = false;
        reloadProgress = 0;
      }
    }, 16);
  }

  function damagePlayer(playerId: string, damage: number) {
    const player = gameState.room.players?.find((p) => p.id === playerId);
    if (player) {
      player.health = Math.max(0, (player.health || 100) - damage);
      
      // Send damage event over WebRTC
      if (gameConnection.webrtc?.hasDataChannel) {
        gameConnection.webrtc.sendGameEvent({
          type: 'playerDamaged',
          targetId: playerId,
          damage,
          shooterId: gameState.userId
        });
      }
    }
  }

  function createMuzzleFlash() {
    // Large bright muzzle flash at gun barrel position
    const flashGeom = new BoxGeometry(0.1, 0.1, 0.2);
    const flashMat = new MeshBasicMaterial({ color: 0xff6600, emissive: 0xff3300 });
    
    // Gun barrel is at camera position + offset [0.3, -0.2, -0.5]
    const pos = camera.current.position.clone().add(new Vector3(0.3, -0.2, -0.5));
    
    const flash = new Mesh(flashGeom, flashMat);
    flash.position.copy(pos);
    scene.add(flash);
    
    // Remove after 100ms
    setTimeout(() => scene.remove(flash), 100);
  }

  function createBulletTrajectory(start: Vector3, end: Vector3) {
    const points = [start, end];
    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new Line(geometry, material);
    
    scene.add(line);
    
    // Remove after 200ms
    setTimeout(() => scene.remove(line), 200);
  }

  function createImpactPoint(position: Vector3) {
    // Impact sphere
    const impactGeom = new BoxGeometry(0.2, 0.2, 0.2);
    const impactMat = new MeshBasicMaterial({ color: 0xffff00, emissive: 0xffff00 });
    
    const impact = new Mesh(impactGeom, impactMat);
    impact.position.copy(position);
    scene.add(impact);
    
    // Remove after 150ms
    setTimeout(() => scene.remove(impact), 150);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;
    
    if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      reload();
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (document.activeElement?.tagName === 'INPUT') return;
    if (e.button === 0) { // Left click
      shoot();
    }
  }

  $effect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  });
</script>

<!-- Gun barrel at screen center -->
<T.Mesh position={[0.3, -0.2, -0.5]}>
  <T.BoxGeometry args={[0.05, 0.05, 0.15]} />
  <T.MeshBasicMaterial color={0x333333} />
</T.Mesh>

<!-- Gun stock -->
<T.Mesh position={[0.2, -0.15, -0.3]}>
  <T.BoxGeometry args={[0.08, 0.1, 0.2]} />
  <T.MeshBasicMaterial color={0x2a2a2a} />
</T.Mesh>

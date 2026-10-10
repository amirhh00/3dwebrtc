<script lang="ts">
  import { T } from '@threlte/core';

  interface Props {
    handedness?: 'left' | 'right';
    color?: string;
    trigger?: number; // 0 (released) to 1 (fully pulled)
    grip?: number; // 0 (open) to 1 (fully squeezed)
    thumb?: number; // 0 (raised) to 1 (touching stick/pad)
    hasGun?: boolean;
    scale?: number;
    showWristHud?: boolean;
    health?: number;
    ammo?: number;
    isReloading?: boolean;
  }

  const {
    handedness = 'right',
    color = '#0284c7',
    trigger = 0,
    grip = 0,
    thumb = 0,
    hasGun = false,
    scale = 1,
    showWristHud = false,
    health = 100,
    ammo = 30,
    isReloading = false
  }: Props = $props();

  const isLeft = $derived(handedness === 'left');
  const sign = $derived(isLeft ? -1 : 1);

  // Dynamic finger curls based on Steam Frame controller inputs
  // Index finger curls with trigger pull
  const indexCurl = $derived(hasGun ? 0.4 + trigger * 0.7 : trigger * 1.25);
  // Middle, ring, and pinky curl with grip squeeze
  const middleCurl = $derived(hasGun ? 0.95 + grip * 0.35 : 0.15 + grip * 1.25);
  const ringCurl = $derived(hasGun ? 0.9 + grip * 0.35 : 0.15 + grip * 1.2);
  const pinkyCurl = $derived(hasGun ? 0.85 + grip * 0.35 : 0.15 + grip * 1.15);
  // Thumb reacts to thumb touch / stick
  const thumbCurl = $derived(0.2 + thumb * 0.65);
</script>

<T.Group scale={[scale, scale, scale]}>
  <!-- Wrist Cuff -->
  <T.Mesh position={[0, -0.01, 0.055]} rotation.x={0.1}>
    <T.BoxGeometry args={[0.06, 0.038, 0.035]} />
    <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
  </T.Mesh>

  <!-- Palm Body -->
  <T.Mesh position={[0, 0, 0]}>
    <T.BoxGeometry args={[0.065, 0.024, 0.075]} />
    <T.MeshStandardMaterial {color} metalness={0.5} roughness={0.4} />
  </T.Mesh>

  <!-- Palm Back Armor Plate -->
  <T.Mesh position={[0, 0.014, 0.005]}>
    <T.BoxGeometry args={[0.058, 0.008, 0.062]} />
    <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
  </T.Mesh>

  <!-- Palm Glowing Energy Core -->
  <T.Mesh position={[0, -0.013, 0]} rotation.x={Math.PI / 2}>
    <T.CylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
    <T.MeshBasicMaterial color="#38bdf8" />
  </T.Mesh>

  <!-- ==================== THUMB ==================== -->
  <T.Group
    position={[sign * 0.036, -0.005, 0.015]}
    rotation.y={sign * 0.55}
    rotation.z={sign * -0.3}
  >
    <!-- Thumb Knuckle -->
    <T.Mesh>
      <T.SphereGeometry args={[0.009, 8, 8]} />
      <T.MeshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
    </T.Mesh>
    <!-- Thumb Base Segment -->
    <T.Group rotation.x={-thumbCurl * 0.7} rotation.z={sign * (thumbCurl * 0.35)}>
      <T.Mesh position={[0, 0.002, -0.014]}>
        <T.BoxGeometry args={[0.014, 0.013, 0.024]} />
        <T.MeshStandardMaterial {color} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <!-- Thumb Distal Joint & Tip -->
      <T.Group position={[0, 0, -0.026]} rotation.x={-thumbCurl * 0.6}>
        <T.Mesh position={[0, 0, -0.01]}>
          <T.BoxGeometry args={[0.013, 0.011, 0.018]} />
          <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </T.Mesh>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ==================== INDEX FINGER (Trigger) ==================== -->
  <T.Group position={[sign * 0.023, 0.002, -0.038]}>
    <!-- Knuckle joint -->
    <T.Mesh>
      <T.SphereGeometry args={[0.008, 8, 8]} />
      <T.MeshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
    </T.Mesh>
    <!-- Phalanx 1 (proximal) -->
    <T.Group rotation.x={-indexCurl * 0.65}>
      <T.Mesh position={[0, -0.002, -0.012]}>
        <T.BoxGeometry args={[0.013, 0.013, 0.022]} />
        <T.MeshStandardMaterial {color} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <!-- Phalanx 2 (intermediate) -->
      <T.Group position={[0, -0.002, -0.023]} rotation.x={-indexCurl * 0.8}>
        <T.Mesh position={[0, -0.001, -0.009]}>
          <T.BoxGeometry args={[0.012, 0.012, 0.018]} />
          <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </T.Mesh>
        <!-- Phalanx 3 (distal tip) -->
        <T.Group position={[0, -0.001, -0.018]} rotation.x={-indexCurl * 0.7}>
          <T.Mesh position={[0, 0, -0.007]}>
            <T.BoxGeometry args={[0.011, 0.01, 0.014]} />
            <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </T.Mesh>
        </T.Group>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ==================== MIDDLE FINGER (Grip) ==================== -->
  <T.Group position={[sign * 0.008, 0.003, -0.039]}>
    <T.Mesh>
      <T.SphereGeometry args={[0.008, 8, 8]} />
      <T.MeshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
    </T.Mesh>
    <T.Group rotation.x={-middleCurl * 0.7}>
      <T.Mesh position={[0, -0.002, -0.014]}>
        <T.BoxGeometry args={[0.0135, 0.013, 0.025]} />
        <T.MeshStandardMaterial {color} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <T.Group position={[0, -0.002, -0.026]} rotation.x={-middleCurl * 0.85}>
        <T.Mesh position={[0, -0.001, -0.01]}>
          <T.BoxGeometry args={[0.0125, 0.012, 0.019]} />
          <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </T.Mesh>
        <T.Group position={[0, -0.001, -0.019]} rotation.x={-middleCurl * 0.75}>
          <T.Mesh position={[0, 0, -0.008]}>
            <T.BoxGeometry args={[0.0115, 0.01, 0.015]} />
            <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </T.Mesh>
        </T.Group>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ==================== RING FINGER (Grip) ==================== -->
  <T.Group position={[sign * -0.008, 0.002, -0.038]}>
    <T.Mesh>
      <T.SphereGeometry args={[0.0075, 8, 8]} />
      <T.MeshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
    </T.Mesh>
    <T.Group rotation.x={-ringCurl * 0.7}>
      <T.Mesh position={[0, -0.002, -0.012]}>
        <T.BoxGeometry args={[0.013, 0.0125, 0.022]} />
        <T.MeshStandardMaterial {color} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <T.Group position={[0, -0.002, -0.023]} rotation.x={-ringCurl * 0.85}>
        <T.Mesh position={[0, -0.001, -0.009]}>
          <T.BoxGeometry args={[0.012, 0.0115, 0.017]} />
          <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </T.Mesh>
        <T.Group position={[0, -0.001, -0.017]} rotation.x={-ringCurl * 0.75}>
          <T.Mesh position={[0, 0, -0.007]}>
            <T.BoxGeometry args={[0.011, 0.01, 0.014]} />
            <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </T.Mesh>
        </T.Group>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ==================== PINKY FINGER (Grip) ==================== -->
  <T.Group position={[sign * -0.023, 0, -0.035]}>
    <T.Mesh>
      <T.SphereGeometry args={[0.007, 8, 8]} />
      <T.MeshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
    </T.Mesh>
    <T.Group rotation.x={-pinkyCurl * 0.7}>
      <T.Mesh position={[0, -0.002, -0.01]}>
        <T.BoxGeometry args={[0.012, 0.012, 0.019]} />
        <T.MeshStandardMaterial {color} metalness={0.6} roughness={0.4} />
      </T.Mesh>
      <T.Group position={[0, -0.002, -0.02]} rotation.x={-pinkyCurl * 0.85}>
        <T.Mesh position={[0, -0.001, -0.008]}>
          <T.BoxGeometry args={[0.011, 0.011, 0.015]} />
          <T.MeshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </T.Mesh>
        <T.Group position={[0, -0.001, -0.015]} rotation.x={-pinkyCurl * 0.75}>
          <T.Mesh position={[0, 0, -0.006]}>
            <T.BoxGeometry args={[0.01, 0.009, 0.012]} />
            <T.MeshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </T.Mesh>
        </T.Group>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ==================== GUN IN HAND ==================== -->
  {#if hasGun}
    <T.Group position={[0, -0.01, -0.05]} rotation.x={-Math.PI / 4}>
      <!-- Main gun body / receiver -->
      <T.Mesh position={[0, 0.02, -0.08]}>
        <T.BoxGeometry args={[0.035, 0.045, 0.16]} />
        <T.MeshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
      </T.Mesh>
      <!-- Top Rail with Neon Trim -->
      <T.Mesh position={[0, 0.046, -0.07]}>
        <T.BoxGeometry args={[0.02, 0.008, 0.13]} />
        <T.MeshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.7} />
      </T.Mesh>
      <!-- Gun Handle in Grip -->
      <T.Mesh position={[0, -0.04, -0.01]} rotation.x={0.25}>
        <T.BoxGeometry args={[0.028, 0.09, 0.038]} />
        <T.MeshStandardMaterial color="#0f172a" roughness={0.9} />
      </T.Mesh>
      <!-- Trigger Guard -->
      <T.Mesh position={[0, -0.015, -0.03]}>
        <T.BoxGeometry args={[0.01, 0.022, 0.035]} />
        <T.MeshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </T.Mesh>
      <!-- Moving Trigger Piece (pulls back with trigger value!) -->
      <T.Mesh position={[0, -0.012, -0.026 - trigger * 0.008]} rotation.x={trigger * 0.25}>
        <T.BoxGeometry args={[0.006, 0.014, 0.006]} />
        <T.MeshStandardMaterial color="#ef4444" metalness={0.9} roughness={0.2} />
      </T.Mesh>
      <!-- Laser Sight Targeting Beam -->
      <T.Mesh position={[0, 0.035, -2.5]} rotation.x={Math.PI / 2}>
        <T.CylinderGeometry args={[0.0012, 0.0012, 5, 8]} />
        <T.MeshBasicMaterial color="#ef4444" transparent opacity={0.6} />
      </T.Mesh>
      <!-- Muzzle Glow Dot -->
      <T.Mesh position={[0, 0.035, -0.165]}>
        <T.SphereGeometry args={[0.004, 8, 8]} />
        <T.MeshBasicMaterial color="#ef4444" />
      </T.Mesh>
    </T.Group>
  {/if}

  <!-- ==================== SMARTWATCH WRIST HUD ==================== -->
  {#if showWristHud}
    <T.Group position={[0, 0.025, 0.055]} rotation.x={Math.PI / 4}>
      <!-- Watch Chassis -->
      <T.Mesh>
        <T.BoxGeometry args={[0.075, 0.048, 0.008]} />
        <T.MeshStandardMaterial color="#090d16" metalness={0.8} roughness={0.2} />
      </T.Mesh>
      <!-- Display screen glass -->
      <T.Mesh position={[0, 0, 0.005]}>
        <T.BoxGeometry args={[0.068, 0.042, 0.001]} />
        <T.MeshBasicMaterial color="#020617" />
      </T.Mesh>
      <!-- Health Bar Track -->
      <T.Mesh position={[0, 0.01, 0.006]}>
        <T.BoxGeometry args={[0.062, 0.011, 0.001]} />
        <T.MeshBasicMaterial color="#1e293b" />
      </T.Mesh>
      <!-- Health Bar Fill -->
      <T.Mesh
        position={[(health / 100 - 1) * 0.031, 0.01, 0.007]}
        scale.x={Math.max(0.001, health / 100)}
      >
        <T.BoxGeometry args={[0.062, 0.011, 0.001]} />
        <T.MeshBasicMaterial
          color={health > 50 ? '#22c55e' : health > 25 ? '#eab308' : '#ef4444'}
        />
      </T.Mesh>
      <!-- Ammo Bar Track -->
      <T.Mesh position={[0, -0.01, 0.006]}>
        <T.BoxGeometry args={[0.062, 0.011, 0.001]} />
        <T.MeshBasicMaterial color="#1e293b" />
      </T.Mesh>
      <!-- Ammo Bar Fill -->
      <T.Mesh
        position={[(ammo / 30 - 1) * 0.031, -0.01, 0.007]}
        scale.x={Math.max(0.001, ammo / 30)}
      >
        <T.BoxGeometry args={[0.062, 0.011, 0.001]} />
        <T.MeshBasicMaterial color={isReloading ? '#eab308' : ammo > 10 ? '#38bdf8' : '#ef4444'} />
      </T.Mesh>
    </T.Group>
  {/if}
</T.Group>

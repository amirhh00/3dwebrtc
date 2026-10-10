<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useController } from '@threlte/xr';
  import { Text } from '@threlte/extras';
  import { playerInfo } from '$lib/store/game.svelte';
  import { playButtonClick } from '$lib/audio/gameAudio';
  import type { Group } from 'three';

  interface Props {
    handedness: 'left' | 'right';
  }

  const { handedness }: Props = $props();
  const isLeft = $derived(handedness === 'left');
  const sign = $derived(isLeft ? -1 : 1);

  // svelte-ignore state_referenced_locally
  const controller = useController(handedness);

  let handGroup = $state<Group>();

  // Live controller state from Gamepad API
  let isConnected = $state(false);
  let trigger = $state(0);
  let grip = $state(0);
  let thumbstickX = $state(0);
  let thumbstickY = $state(0);
  let thumbstickClick = $state(false);
  let btnPrimary = $state(false); // A (right) / X (left)
  let btnSecondary = $state(false); // B (right) / Y (left)
  let btnMenu = $state(false);
  let thumbTouch = $state(0);

  let prevBtnPrimary = false;
  let prevBtnSecondary = false;

  // Finger kinematic curls based on inputs
  // Index finger moves with analog trigger
  const indexCurl = $derived(trigger * 1.35);
  // Middle, ring, and pinky move with analog grip squeeze
  const middleCurl = $derived(0.1 + grip * 1.3);
  const ringCurl = $derived(0.1 + grip * 1.25);
  const pinkyCurl = $derived(0.1 + grip * 1.2);
  // Thumb reacts to thumb touch / stick movement
  const thumbCurl = $derived(0.2 + thumbTouch * 0.7);

  useTask(() => {
    const gp = $controller?.inputSource?.gamepad;
    if (!gp) {
      isConnected = false;
      return;
    }
    isConnected = true;

    // 1. Analog Trigger (Button 0)
    const b0 = gp.buttons[0];
    const newTrig = b0 ? (b0.value ?? (b0.pressed ? 1 : 0)) : 0;
    trigger = Math.max(0, Math.min(1, newTrig));

    // 2. Analog Grip Squeeze (Button 1 or 2)
    const b1 = gp.buttons[1] ?? gp.buttons[2];
    const newGrip = b1 ? (b1.value ?? (b1.pressed ? 1 : 0)) : 0;
    grip = Math.max(0, Math.min(1, newGrip));

    // 3. Thumbstick Axes (X / Y)
    if (gp.axes.length >= 4) {
      thumbstickX = gp.axes[2] ?? 0;
      thumbstickY = gp.axes[3] ?? 0;
      if (Math.abs(thumbstickX) < 0.05 && Math.abs(thumbstickY) < 0.05) {
        thumbstickX = gp.axes[0] ?? 0;
        thumbstickY = gp.axes[1] ?? 0;
      }
    } else if (gp.axes.length >= 2) {
      thumbstickX = gp.axes[0] ?? 0;
      thumbstickY = gp.axes[1] ?? 0;
    }

    // Apply deadzone
    if (Math.abs(thumbstickX) < 0.08) thumbstickX = 0;
    if (Math.abs(thumbstickY) < 0.08) thumbstickY = 0;

    // 4. Thumbstick Click (Button 3)
    thumbstickClick = Boolean(gp.buttons[3]?.pressed);

    // 5. Face Buttons
    const currPrimary = Boolean(gp.buttons[4]?.pressed);
    const currSecondary = Boolean(gp.buttons[5]?.pressed);
    btnMenu = Boolean(gp.buttons[6]?.pressed);

    // Haptic pulse on button press transition
    if ((!prevBtnPrimary && currPrimary) || (!prevBtnSecondary && currSecondary)) {
      playButtonClick();
      try {
        if (gp.hapticActuators && gp.hapticActuators[0]) {
          void gp.hapticActuators[0].pulse(0.6, 35);
        }
      } catch {}
    }

    prevBtnPrimary = currPrimary;
    prevBtnSecondary = currSecondary;
    btnPrimary = currPrimary;
    btnSecondary = currSecondary;

    // 6. Thumb touch: active if touching stick or buttons
    const isTouched =
      Math.abs(thumbstickX) > 0.05 ||
      Math.abs(thumbstickY) > 0.05 ||
      btnPrimary ||
      btnSecondary ||
      Boolean(gp.buttons[4]?.touched) ||
      Boolean(gp.buttons[5]?.touched) ||
      Boolean(gp.buttons[3]?.touched);
    thumbTouch = isTouched ? 1 : 0;
  });
</script>

<T.Group bind:ref={handGroup}>
  <!-- ======================================================== -->
  <!-- 1. PHYSICAL 3D CONTROLLER BODY & HARDWARE FEEDBACK       -->
  <!-- ======================================================== -->
  <T.Group position={[0, -0.015, 0.01]} rotation.x={0.15}>
    <!-- Controller Main Handle -->
    <T.Mesh position={[0, -0.045, 0.03]} rotation.x={0.2}>
      <T.CylinderGeometry args={[0.018, 0.014, 0.12, 16]} />
      <T.MeshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.6} />
    </T.Mesh>

    <!-- Side Grip Squeeze Plate (Physically compresses inward as grip increases!) -->
    <T.Mesh
      position={[sign * (0.017 - grip * 0.005), -0.04, 0.03]}
      rotation.x={0.2}
    >
      <T.BoxGeometry args={[0.006, 0.07, 0.02]} />
      <T.MeshStandardMaterial
        color={grip > 0.2 ? '#22c55e' : '#334155'}
        emissive={grip > 0.2 ? '#22c55e' : '#000000'}
        emissiveIntensity={grip * 0.8}
        metalness={0.8}
      />
    </T.Mesh>

    <!-- Moving Trigger Button (Under index finger, pulls back as trigger increases!) -->
    <T.Group
      position={[0, -0.012, -0.02 - trigger * 0.012]}
      rotation.x={trigger * 0.25}
    >
      <T.Mesh>
        <T.BoxGeometry args={[0.012, 0.022, 0.016]} />
        <T.MeshStandardMaterial
          color={trigger > 0.1 ? '#06b6d4' : '#1e293b'}
          emissive={trigger > 0.1 ? '#06b6d4' : '#000000'}
          emissiveIntensity={trigger * 0.9}
          metalness={0.8}
        />
      </T.Mesh>
    </T.Group>

    <!-- Controller Top Face / Sensor Ring -->
    <T.Mesh position={[0, 0.018, -0.02]} rotation.x={-0.3}>
      <T.CylinderGeometry args={[0.036, 0.034, 0.012, 24]} />
      <T.MeshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
    </T.Mesh>

    <!-- 3D Mini Thumbstick (Physically tilts and clicks in 3D!) -->
    <T.Group position={[sign * -0.012, 0.026, -0.02]} rotation.x={-0.3}>
      <!-- Stick Socket Base -->
      <T.Mesh>
        <T.CylinderGeometry args={[0.011, 0.012, 0.003, 16]} />
        <T.MeshStandardMaterial color="#090d16" />
      </T.Mesh>
      <!-- Tilting Joystick Stem & Cap -->
      <T.Group
        position.y={thumbstickClick ? -0.003 : 0}
        rotation.x={thumbstickY * 0.45}
        rotation.z={-thumbstickX * 0.45}
      >
        <T.Mesh position={[0, 0.005, 0]}>
          <T.CylinderGeometry args={[0.003, 0.003, 0.01, 8]} />
          <T.MeshStandardMaterial color="#64748b" metalness={0.9} />
        </T.Mesh>
        <!-- Top Thumbstick Cap -->
        <T.Mesh position={[0, 0.01, 0]}>
          <T.CylinderGeometry args={[0.009, 0.008, 0.004, 16]} />
          <T.MeshStandardMaterial
            color={thumbstickClick ? '#ec4899' : Math.abs(thumbstickX) > 0.1 || Math.abs(thumbstickY) > 0.1 ? '#38bdf8' : '#334155'}
            emissive={thumbstickClick ? '#ec4899' : '#0284c7'}
            emissiveIntensity={thumbstickClick ? 1 : 0.4}
          />
        </T.Mesh>
      </T.Group>
    </T.Group>

    <!-- Primary Face Button: [A] on Right / [X] on Left -->
    <T.Group position={[sign * 0.014, 0.026, -0.015]} rotation.x={-0.3}>
      <T.Mesh position.y={btnPrimary ? -0.002 : 0}>
        <T.CylinderGeometry args={[0.006, 0.006, 0.005, 16]} />
        <T.MeshStandardMaterial
          color={btnPrimary ? '#22c55e' : '#38bdf8'}
          emissive={btnPrimary ? '#22c55e' : '#0284c7'}
          emissiveIntensity={btnPrimary ? 1.2 : 0.3}
        />
      </T.Mesh>
    </T.Group>

    <!-- Secondary Face Button: [B] on Right / [Y] on Left -->
    <T.Group position={[sign * 0.012, 0.026, -0.028]} rotation.x={-0.3}>
      <T.Mesh position.y={btnSecondary ? -0.002 : 0}>
        <T.CylinderGeometry args={[0.006, 0.006, 0.005, 16]} />
        <T.MeshStandardMaterial
          color={btnSecondary ? '#22c55e' : '#38bdf8'}
          emissive={btnSecondary ? '#22c55e' : '#0284c7'}
          emissiveIntensity={btnSecondary ? 1.2 : 0.3}
        />
      </T.Mesh>
    </T.Group>

    <!-- Menu / System Button -->
    <T.Group position={[0, 0.025, -0.005]} rotation.x={-0.3}>
      <T.Mesh position.y={btnMenu ? -0.002 : 0}>
        <T.CylinderGeometry args={[0.004, 0.004, 0.004, 12]} />
        <T.MeshStandardMaterial
          color={btnMenu ? '#eab308' : '#475569'}
          emissive={btnMenu ? '#eab308' : '#000000'}
          emissiveIntensity={btnMenu ? 1.0 : 0}
        />
      </T.Mesh>
    </T.Group>
  </T.Group>

  <!-- ======================================================== -->
  <!-- 2. ARTICULATED VIRTUAL HAND WITH INDIVIDUAL FINGERS      -->
  <!-- ======================================================== -->
  <T.Group position={[0, 0, 0]}>
    <!-- Palm Body -->
    <T.Mesh position={[0, 0, 0]}>
      <T.BoxGeometry args={[0.062, 0.022, 0.072]} />
      <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.5} roughness={0.4} />
    </T.Mesh>

    <!-- Palm Armor Backplate -->
    <T.Mesh position={[0, 0.013, 0.004]}>
      <T.BoxGeometry args={[0.056, 0.006, 0.06]} />
      <T.MeshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.25} />
    </T.Mesh>

    <!-- Palm Glowing Energy Core -->
    <T.Mesh position={[0, -0.012, 0]} rotation.x={Math.PI / 2}>
      <T.CylinderGeometry args={[0.012, 0.012, 0.003, 16]} />
      <T.MeshBasicMaterial color="#38bdf8" />
    </T.Mesh>

    <!-- -------------------------------------------------------- -->
    <!-- THUMB (Reacts to Thumb Touch / Stick)                    -->
    <!-- -------------------------------------------------------- -->
    <T.Group
      position={[sign * 0.034, -0.004, 0.014]}
      rotation.y={sign * 0.55}
      rotation.z={sign * -0.3}
    >
      <!-- Knuckle -->
      <T.Mesh>
        <T.SphereGeometry args={[0.0085, 8, 8]} />
        <T.MeshStandardMaterial color="#334155" metalness={0.7} />
      </T.Mesh>
      <!-- Proximal Segment -->
      <T.Group rotation.x={-thumbCurl * 0.7} rotation.z={sign * (thumbCurl * 0.35)}>
        <T.Mesh position={[0, 0.002, -0.013]}>
          <T.BoxGeometry args={[0.013, 0.012, 0.022]} />
          <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.6} roughness={0.4} />
        </T.Mesh>
        <!-- Distal Joint & Tip -->
        <T.Group position={[0, 0, -0.024]} rotation.x={-thumbCurl * 0.6}>
          <T.Mesh position={[0, 0, -0.009]}>
            <T.BoxGeometry args={[0.012, 0.01, 0.017]} />
            <T.MeshStandardMaterial color="#0f172a" metalness={0.8} />
          </T.Mesh>
        </T.Group>
      </T.Group>
    </T.Group>

    <!-- -------------------------------------------------------- -->
    <!-- INDEX FINGER (Curls with Analog Trigger Pull!)          -->
    <!-- -------------------------------------------------------- -->
    <T.Group position={[sign * 0.022, 0.002, -0.036]}>
      <!-- Knuckle -->
      <T.Mesh>
        <T.SphereGeometry args={[0.008, 8, 8]} />
        <T.MeshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
      </T.Mesh>
      <!-- Phalanx 1 (Proximal) -->
      <T.Group rotation.x={-indexCurl * 0.65}>
        <T.Mesh position={[0, -0.002, -0.012]}>
          <T.BoxGeometry args={[0.012, 0.012, 0.021]} />
          <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.6} roughness={0.4} />
        </T.Mesh>
        <!-- Phalanx 2 (Intermediate) -->
        <T.Group position={[0, -0.002, -0.022]} rotation.x={-indexCurl * 0.8}>
          <T.Mesh position={[0, -0.001, -0.009]}>
            <T.BoxGeometry args={[0.011, 0.011, 0.017]} />
            <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
          </T.Mesh>
          <!-- Phalanx 3 (Distal Tip) -->
          <T.Group position={[0, -0.001, -0.017]} rotation.x={-indexCurl * 0.7}>
            <T.Mesh position={[0, 0, -0.007]}>
              <T.BoxGeometry args={[0.01, 0.009, 0.013]} />
              <T.MeshStandardMaterial color="#0f172a" metalness={0.85} />
            </T.Mesh>
          </T.Group>
        </T.Group>
      </T.Group>
    </T.Group>

    <!-- -------------------------------------------------------- -->
    <!-- MIDDLE FINGER (Curls with Analog Grip Squeeze!)         -->
    <!-- -------------------------------------------------------- -->
    <T.Group position={[sign * 0.007, 0.003, -0.038]}>
      <T.Mesh>
        <T.SphereGeometry args={[0.008, 8, 8]} />
        <T.MeshStandardMaterial color="#334155" metalness={0.7} />
      </T.Mesh>
      <T.Group rotation.x={-middleCurl * 0.7}>
        <T.Mesh position={[0, -0.002, -0.013]}>
          <T.BoxGeometry args={[0.013, 0.012, 0.024]} />
          <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.6} roughness={0.4} />
        </T.Mesh>
        <T.Group position={[0, -0.002, -0.025]} rotation.x={-middleCurl * 0.85}>
          <T.Mesh position={[0, -0.001, -0.01]}>
            <T.BoxGeometry args={[0.012, 0.011, 0.018]} />
            <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
          </T.Mesh>
          <T.Group position={[0, -0.001, -0.018]} rotation.x={-middleCurl * 0.75}>
            <T.Mesh position={[0, 0, -0.008]}>
              <T.BoxGeometry args={[0.011, 0.009, 0.014]} />
              <T.MeshStandardMaterial color="#0f172a" metalness={0.85} />
            </T.Mesh>
          </T.Group>
        </T.Group>
      </T.Group>
    </T.Group>

    <!-- -------------------------------------------------------- -->
    <!-- RING FINGER (Curls with Analog Grip Squeeze!)            -->
    <!-- -------------------------------------------------------- -->
    <T.Group position={[sign * -0.008, 0.002, -0.036]}>
      <T.Mesh>
        <T.SphereGeometry args={[0.0075, 8, 8]} />
        <T.MeshStandardMaterial color="#334155" metalness={0.7} />
      </T.Mesh>
      <T.Group rotation.x={-ringCurl * 0.7}>
        <T.Mesh position={[0, -0.002, -0.012]}>
          <T.BoxGeometry args={[0.012, 0.0115, 0.021]} />
          <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.6} roughness={0.4} />
        </T.Mesh>
        <T.Group position={[0, -0.002, -0.022]} rotation.x={-ringCurl * 0.85}>
          <T.Mesh position={[0, -0.001, -0.009]}>
            <T.BoxGeometry args={[0.011, 0.0105, 0.016]} />
            <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
          </T.Mesh>
          <T.Group position={[0, -0.001, -0.016]} rotation.x={-ringCurl * 0.75}>
            <T.Mesh position={[0, 0, -0.007]}>
              <T.BoxGeometry args={[0.01, 0.009, 0.013]} />
              <T.MeshStandardMaterial color="#0f172a" metalness={0.85} />
            </T.Mesh>
          </T.Group>
        </T.Group>
      </T.Group>
    </T.Group>

    <!-- -------------------------------------------------------- -->
    <!-- PINKY FINGER (Curls with Analog Grip Squeeze!)           -->
    <!-- -------------------------------------------------------- -->
    <T.Group position={[sign * -0.022, 0, -0.033]}>
      <T.Mesh>
        <T.SphereGeometry args={[0.007, 8, 8]} />
        <T.MeshStandardMaterial color="#334155" metalness={0.7} />
      </T.Mesh>
      <T.Group rotation.x={-pinkyCurl * 0.7}>
        <T.Mesh position={[0, -0.002, -0.01]}>
          <T.BoxGeometry args={[0.011, 0.011, 0.018]} />
          <T.MeshStandardMaterial color={playerInfo.playerColor || '#0284c7'} metalness={0.6} roughness={0.4} />
        </T.Mesh>
        <T.Group position={[0, -0.002, -0.019]} rotation.x={-pinkyCurl * 0.85}>
          <T.Mesh position={[0, -0.001, -0.008]}>
            <T.BoxGeometry args={[0.01, 0.01, 0.014]} />
            <T.MeshStandardMaterial color="#1e293b" metalness={0.7} />
          </T.Mesh>
          <T.Group position={[0, -0.001, -0.014]} rotation.x={-pinkyCurl * 0.75}>
            <T.Mesh position={[0, 0, -0.006]}>
              <T.BoxGeometry args={[0.009, 0.008, 0.011]} />
              <T.MeshStandardMaterial color="#0f172a" metalness={0.85} />
            </T.Mesh>
          </T.Group>
        </T.Group>
      </T.Group>
    </T.Group>
  </T.Group>

  <!-- ======================================================== -->
  <!-- 3. PURE 3D SMARTWATCH TELEMETRY CONSOLE                  -->
  <!-- ======================================================== -->
  <T.Group position={[0, 0.038, 0.05]} rotation.x={Math.PI / 4}>
    <!-- Watch Body -->
    <T.Mesh castShadow>
      <T.BoxGeometry args={[0.075, 0.055, 0.008]} />
      <T.MeshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
    </T.Mesh>
    <!-- Screen Glass -->
    <T.Mesh position={[0, 0, 0.005]}>
      <T.BoxGeometry args={[0.07, 0.05, 0.001]} />
      <T.MeshBasicMaterial color="#020617" />
    </T.Mesh>

    <!-- 3D Header Text -->
    <Text
      text={isLeft ? 'L-CTRL' : 'R-CTRL'}
      fontSize={0.008}
      color="#38bdf8"
      anchorX="left"
      anchorY="top"
      position={[-0.032, 0.021, 0.007]}
    />

    <!-- Trigger Bar Track -->
    <T.Mesh position={[0.005, 0.01, 0.006]}>
      <T.BoxGeometry args={[0.045, 0.004, 0.001]} />
      <T.MeshBasicMaterial color="#1e293b" />
    </T.Mesh>
    <!-- Trigger Bar Fill -->
    <T.Mesh
      position={[-0.0175 + (trigger * 0.045) / 2, 0.01, 0.007]}
      scale.x={Math.max(0.01, trigger)}
    >
      <T.BoxGeometry args={[0.045, 0.004, 0.001]} />
      <T.MeshBasicMaterial color="#06b6d4" />
    </T.Mesh>
    <Text
      text="TRIG"
      fontSize={0.006}
      color="#94a3b8"
      anchorX="right"
      anchorY="middle"
      position={[-0.02, 0.01, 0.007]}
    />

    <!-- Grip Bar Track -->
    <T.Mesh position={[0.005, 0.002, 0.006]}>
      <T.BoxGeometry args={[0.045, 0.004, 0.001]} />
      <T.MeshBasicMaterial color="#1e293b" />
    </T.Mesh>
    <!-- Grip Bar Fill -->
    <T.Mesh
      position={[-0.0175 + (grip * 0.045) / 2, 0.002, 0.007]}
      scale.x={Math.max(0.01, grip)}
    >
      <T.BoxGeometry args={[0.045, 0.004, 0.001]} />
      <T.MeshBasicMaterial color="#22c55e" />
    </T.Mesh>
    <Text
      text="GRIP"
      fontSize={0.006}
      color="#94a3b8"
      anchorX="right"
      anchorY="middle"
      position={[-0.02, 0.002, 0.007]}
    />

    <!-- Buttons Indicator Badges -->
    <Text
      text={`${isLeft ? 'X' : 'A'}: ${btnPrimary ? 'ON' : 'OFF'}  ${isLeft ? 'Y' : 'B'}: ${btnSecondary ? 'ON' : 'OFF'}`}
      fontSize={0.0065}
      color={btnPrimary || btnSecondary ? '#22c55e' : '#64748b'}
      anchorX="center"
      anchorY="middle"
      position={[0, -0.01, 0.007]}
    />

    <Text
      text={`STICK: (${thumbstickX.toFixed(1)}, ${thumbstickY.toFixed(1)})`}
      fontSize={0.006}
      color="#94a3b8"
      anchorX="center"
      anchorY="middle"
      position={[0, -0.018, 0.007]}
    />
  </T.Group>
</T.Group>

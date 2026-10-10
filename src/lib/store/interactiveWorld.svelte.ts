export interface InteractiveItem {
  id: string;
  type: 'box' | 'ball' | 'baton';
  x: number;
  y: number;
  z: number;
  color: string;
  radius?: number;
  size?: [number, number, number];
}

/*
 * Table layout (world space) — see InteractiveStation.svelte
 *   Table centre z = -0.62, depth 0.56  -> front edge z = -0.34, back edge z = -0.90
 *   Table surface y = 1.41
 *   Buttons strip:  z ≈ -0.44 (front, closest to player)
 *   Divider rail:   z ≈ -0.54
 *   Props tray:     z ≈ -0.62 … -0.86 (behind the rail, fenced on 3 sides)
 */
const TRAY_Z = -0.74;
const SURFACE_Y = 1.41;
const CUBE = 0.12;
const BALL_R = 0.06;

let nextId = 1;
const uid = (prefix: string) => `${prefix}-${nextId++}`;

function createInitialItems(): InteractiveItem[] {
  const y0 = SURFACE_Y + CUBE / 2 + 0.005;
  return [
    // Small cube pyramid on the left of the tray
    { id: uid('box'), type: 'box', x: -0.42, y: y0, z: TRAY_Z, color: '#38bdf8', size: [CUBE, CUBE, CUBE] },
    { id: uid('box'), type: 'box', x: -0.28, y: y0, z: TRAY_Z, color: '#10b981', size: [CUBE, CUBE, CUBE] },
    { id: uid('box'), type: 'box', x: -0.35, y: y0 + CUBE + 0.005, z: TRAY_Z, color: '#f59e0b', size: [CUBE, CUBE, CUBE] },
    // Cubes on the right
    { id: uid('box'), type: 'box', x: 0.30, y: y0, z: TRAY_Z, color: '#f43f5e', size: [CUBE, CUBE, CUBE] },
    { id: uid('box'), type: 'box', x: 0.44, y: y0, z: TRAY_Z, color: '#a855f7', size: [CUBE, CUBE, CUBE] },
    // Balls in the middle
    { id: uid('ball'), type: 'ball', x: -0.10, y: SURFACE_Y + BALL_R + 0.005, z: TRAY_Z, color: '#22c55e', radius: BALL_R },
    { id: uid('ball'), type: 'ball', x: 0.10, y: SURFACE_Y + BALL_R + 0.005, z: TRAY_Z, color: '#eab308', radius: BALL_R },
    // Baton lying flat-ish in the centre-back (stands upright, short)
    { id: uid('baton'), type: 'baton', x: 0.0, y: SURFACE_Y + 0.23, z: TRAY_Z - 0.06, color: '#38bdf8', size: [0.06, 0.45, 0.06] }
  ];
}

export const interactiveWorld = $state({
  gravity: -9.81,
  isLowGravity: false,
  isDiscoMode: false,
  discoHue: 190,
  items: createInitialItems(),
  grabbedItemId: {
    left: null as string | null,
    right: null as string | null
  }
});

export function spawnBlocks() {
  const colors = ['#38bdf8', '#ec4899', '#eab308', '#10b981'];
  const newBlocks: InteractiveItem[] = colors.map((color, i) => ({
    id: uid('box'),
    type: 'box',
    x: -0.3 + i * 0.2,
    y: SURFACE_Y + 0.35 + i * 0.05,
    z: TRAY_Z,
    color,
    size: [CUBE, CUBE, CUBE]
  }));
  interactiveWorld.items = [...interactiveWorld.items, ...newBlocks];
}

export function spawnBalls() {
  const colors = ['#f43f5e', '#38bdf8', '#22c55e', '#f59e0b'];
  const newBalls: InteractiveItem[] = colors.map((color, i) => ({
    id: uid('ball'),
    type: 'ball',
    x: -0.3 + i * 0.2,
    y: SURFACE_Y + 0.35 + i * 0.05,
    z: TRAY_Z,
    color,
    radius: BALL_R
  }));
  interactiveWorld.items = [...interactiveWorld.items, ...newBalls];
}

export function toggleGravity() {
  interactiveWorld.isLowGravity = !interactiveWorld.isLowGravity;
  interactiveWorld.gravity = interactiveWorld.isLowGravity ? -1.8 : -9.81;
}

export function toggleDisco() {
  interactiveWorld.isDiscoMode = !interactiveWorld.isDiscoMode;
}

/** Remove everything and put the original set back on the tray (new ids => fresh physics bodies). */
export function clearSpawnedItems() {
  interactiveWorld.grabbedItemId.left = null;
  interactiveWorld.grabbedItemId.right = null;
  interactiveWorld.items = createInitialItems();
}

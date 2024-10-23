import type { Props } from '@threlte/core';
import type { Mesh } from 'three';

export type PlayerModelProps = {
  playerColor?: string;
  playerName?: string;
  meshProps?: Props<typeof Mesh>;
};

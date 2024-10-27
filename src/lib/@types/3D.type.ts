import type { Props } from '@threlte/core';
import type { Mesh } from 'three';

export type PlayerModelProps = {
  playerColor?: string;
  playerId: string;
  playerName?: string;
  meshProps?: Props<Mesh>;
  radius: number;
  height: number;
};

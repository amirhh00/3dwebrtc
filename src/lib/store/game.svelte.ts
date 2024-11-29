import type { Message, SeekRoom, UserServer } from '$lib/@types/user.type';
import { writable } from 'svelte/store';

export const micState = writable(false);

export const playerInfo = $state({
  playerName: '',
  playerColor: '#000'
});

export type UserClient = UserServer & {
  position?: number | [x: number, y: number, z: number];
  mic?: boolean;
  stream?: MediaStream;
};
export interface Room extends SeekRoom {
  players?: UserClient[];
  messages?: Message[];
}

export const availableRooms = $state({
  rooms: [] as Room[]
});

export const gameState = $state({
  isPaused: true,
  userId: '',
  room: {} as Room,
  isOver: false as boolean,
  isRoomConnecting: false
});

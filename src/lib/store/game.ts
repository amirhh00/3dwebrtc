import { writable } from 'svelte/store';
import { persistent } from '$lib/persist';
import type { Message, SeekRoom, UserServer } from '$lib/@types/user.type';

export const isPaused = writable(true);

export const gameSettings = persistent('gameSettings', {
  mic: false,
  mute: false,
  playerName: '',
  playerColor: '#FFF'
});

export const userId = writable('');

export interface Room extends SeekRoom {
  players?: UserServer[];
  messages?: Message[];
}

export const rooms = writable<Room[]>([]);

export const gameState = writable({
  room: {} as Room,
  players: [] as UserServer[],
  isOver: false as boolean,
  isRoomConnecting: false
});

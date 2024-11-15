import type { Message, SeekRoom, UserServer } from '$lib/@types/user.type';

export const gameSettings = $state({
  mic: false as boolean,
  mute: false as boolean,
  playerName: '',
  playerColor: '#000'
});

export type UserClient = UserServer & {
  position?: number | [x: number, y: number, z: number];
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

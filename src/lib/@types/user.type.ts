import type { users } from '$lib/server/db/schema';
export type WebRTCData = {
  sdp: string; // SDP offer/answer for WebRTC
};

export type UserServer = typeof users.$inferSelect;

export type UserDetails = Partial<UserServer>;

export type Message = {
  from: UserServer | 'Server';
  time: number;
  message: string;
};

export type RoomState = {
  id: string;
  messages?: Message[];
  users: UserServer[];
};

export type SeekRoom = {
  roomId: string;
  roomName: string;
  playersCount: number;
};

export type RoomStateChanged = {
  from: string;
  event: 'user_left' | 'user_joined' | 'user_name_changed';
  user: string;
  users: UserServer[];
  time: number;
};

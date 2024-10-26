export type WebRTCData = {
  sdp: string; // SDP offer/answer for WebRTC
};

export type UserServer = {
  isHost: boolean;
  id: string;
  name?: string;
  color?: string;
  rtcData?: WebRTCData; // Add WebRTC connection data
};

export type UserDetails = Partial<UserServer>;

export type Message = {
  from: UserServer | 'Server';
  time: number;
  message: string;
};

export type RoomState = {
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

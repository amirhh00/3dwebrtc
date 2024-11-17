export type WebRTCData = {
  sdp: string; // SDP offer/answer for WebRTC
};

export type UserServer = {
  id: string;
  name: string;
  color: string;
  is_host: boolean;
  room_id: string;
  created_at: string;
  updated_at: string;
};

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

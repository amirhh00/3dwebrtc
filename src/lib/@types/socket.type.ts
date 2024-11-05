import type {
  Message,
  RoomState,
  RoomStateChanged,
  SeekRoom,
  UserDetails,
  WebRTCData,
} from "$lib/@types/user.type.ts";

export interface EventsFromClients {
  createRoom: (
    userDetails: UserDetails,
    rtcData: WebRTCData,
    callBackFn: (data: { roomId: string }) => { roomId: string },
  ) => void;
  seekRooms: (callBackFn: (availableRooms: SeekRoom[]) => void) => void;
  joinRoom: (
    roomId: string,
    rtcData: WebRTCData,
    callBackFn: (room: RoomState) => void,
  ) => void;
  selectRoom: (
    roomId: string,
    callBackFn: (roomDetails: RoomState) => void,
  ) => void;
  message: (msg: string) => void;
  name: (name: string) => void;
  disconnect: () => void;
}

export interface EventsToClients {
  name: (name: string) => void;
  err: (data: { from: string; message: string; time: number }) => void;
  roomState: (data: RoomStateChanged) => void;
  message: (data: Message) => void;
}

import type { Room, UserClient } from '$lib/store/game.svelte';

export type RTCData = {
  from: string;
  type: 'position' | 'chat';
  position?: [number, number, number];
  message?: string;
};

interface CommunicationEventBasse {
  from: string;
  event:
    | 'userLeft'
    | 'userJoined'
    | 'userInfoChange'
    | 'chatMessage'
    | 'positionUpdate'
    | 'micToggle';
}

export interface positionUpdate extends CommunicationEventBasse {
  event: 'positionUpdate';
  position: [number, number, number];
  time: number;
}

export interface RoomStateChanged extends CommunicationEventBasse {
  event: 'userLeft' | 'userJoined' | 'userInfoChange';
  user: UserClient;
  room: Room;
  time: number;
}

export interface ChatMessage extends CommunicationEventBasse {
  event: 'chatMessage';
  message: string;
  time: number;
}

export interface MicToggle extends CommunicationEventBasse {
  event: 'micToggle';
  mic?: boolean;
  time: number;
}

export type MeshSignalBody = {
  type: 'offer' | 'answer';
  sdp: RTCSessionDescriptionInit;
};

/** Client → host relay (target peer id). */
export type MeshSignalOutbound = {
  event: 'meshSignal';
  to: string;
  body: MeshSignalBody;
  time: number;
};

/** Host → client (origin peer id). */
export type MeshSignalInbound = {
  event: 'meshSignal';
  from: string;
  body: MeshSignalBody;
  time: number;
};

export type MeshSignalPayload = MeshSignalOutbound | MeshSignalInbound;

export type RTCMessage =
  | positionUpdate
  | MicToggle
  | RoomStateChanged
  | ChatMessage
  | MeshSignalPayload;

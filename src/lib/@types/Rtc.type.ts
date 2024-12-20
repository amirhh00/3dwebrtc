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

interface positionUpdate extends CommunicationEventBasse {
  // from: string;
  position: [number, number, number];
}

interface RoomStateChanged extends CommunicationEventBasse {
  from: string;
  user: UserClient;
  room: Room;
  time: number;
}

interface ChatMessage extends CommunicationEventBasse {
  message: string;
  time: number;
}

interface MicToggle extends CommunicationEventBasse {
  mic?: boolean;
  time: number;
}

export type RTCMessage<T = CommunicationEventBasse['event']> = T extends 'positionUpdate'
  ? positionUpdate
  : T extends 'micToggle'
    ? MicToggle
    : RoomStateChanged | ChatMessage;

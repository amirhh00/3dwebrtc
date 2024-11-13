import { EventEmitter } from 'node:events';

type UserId = string;
type RoomId = string;
type SdpEventKey = `sdp-${UserId}`;
type RoomEventKey = `room-${RoomId}`;

interface SdpEventMap {
  [key: SdpEventKey]: string;
  [key: RoomEventKey]: {
    id: UserId;
    sdp: string;
  };
}

export class SdpEventHandler extends EventEmitter {
  emit<E extends keyof SdpEventMap>(event: E, data: SdpEventMap[E]): boolean {
    return super.emit(event, data);
  }

  on<E extends keyof SdpEventMap>(event: E, listener: (data: SdpEventMap[E]) => void): this {
    return super.on(event, listener);
  }
}

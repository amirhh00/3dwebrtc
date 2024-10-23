import { get, writable } from 'svelte/store';
import ioClient, { type ManagerOptions, type SocketOptions } from 'socket.io-client';
import type { Message, RoomStateChanged, SeekRoom, UserDetails } from '$lib/@types/user.type';
import { gameState, userId, rooms, isPaused } from '$lib/store/game.ts';

class SocketStore {
  private socket = writable<ReturnType<typeof ioClient> | null>(null);
  public isHost = false;

  async connect(url: string, options?: Partial<ManagerOptions & SocketOptions>) {
    return new Promise<void>((resolve) => {
      const socketInstance = ioClient(url, options);
      this.socket.set(socketInstance);
      socketInstance.on('connect', () => {
        this.addListeners();
        resolve();
      });
    });
  }

  async createRoom(userDetails?: UserDetails) {
    return new Promise<void>((resolve) => {
      const s = get(this.socket)!;
      s.emit('createRoom', userDetails);
      s.on('roomCreated', (room: { roomId: string }) => {
        this.isHost = true;
        gameState.update((game) => {
          game.room.roomId = room.roomId;
          game.room.players = [{ isHost: true, id: get(userId)! }];
          game.isRoomConnecting = false;
          return game;
        });
        isPaused.set(false);
        resolve();
      });
    });
  }

  seekRooms() {
    const s = get(this.socket)!;
    s.emit('seekRooms');
    s.on('rooms', (_rooms: SeekRoom[]) => {
      rooms.set(_rooms);
    });
    gameState.update((game) => {
      game.isRoomConnecting = false;
      return game;
    });
  }

  joinRoom(roomId: string) {
    const s = get(this.socket)!;
    s.emit('joinRoom', roomId);
    s.on('roomJoined', (room: string) => {
      gameState.update((game) => {
        game.room.roomId = room;
        game.isRoomConnecting = false;
        return game;
      });
    });
    isPaused.set(false);
  }

  changeName(name: string) {
    const s = get(this.socket)!;
    s.emit('name', name);
  }

  disconnect() {
    this.socket.update((socket) => {
      socket?.disconnect();
      return null;
    });
  }

  subscribe(run: (value: ReturnType<typeof ioClient> | null) => void) {
    return this.socket.subscribe(run);
  }

  private addListeners() {
    const s = get(this.socket)!;
    s.on('name', (name: string) => this.onNameReceived(name));
    s.on('message', (message: Message) => this.onMessageReceived(message));
    s.on('roomState', (roomState: RoomStateChanged) => {
      switch (roomState.event) {
        case 'user_joined':
          this.onUserJoined(roomState);
          break;
        case 'user_left':
          this.onUserLeft(roomState);
          break;
        case 'user_name_changed':
          this.onUserNameChanged(roomState);
          break;
      }
    });
  }

  private onNameReceived = (name: string) => {
    userId.set(name);
  };

  private onMessageReceived = (message: Message) => {
    console.log('message received', message);
    gameState.update((game) => {
      if (!game.room.messages) game.room.messages = [];
      game.room.messages.push(message);
      console.log('new message', message);
      return game;
    });
  };

  private onUserJoined(roomState: RoomStateChanged) {
    console.log('user joined', roomState);
    gameState.update((game) => {
      game.room.players = roomState.users;
      return game;
    });
  }

  private onUserLeft(roomState: RoomStateChanged) {
    gameState.update((game) => {
      game.room.players = roomState.users;
      return game;
    });
  }

  private onUserNameChanged(roomState: RoomStateChanged) {
    gameState.update((game) => {
      game.room.players = roomState.users;
      return game;
    });
  }
}

export const socket = new SocketStore();

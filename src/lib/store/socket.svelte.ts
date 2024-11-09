import ioClient, {
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import type {
  Message,
  RoomStateChanged,
  UserDetails,
} from "$lib/@types/user.type";
import {
  availableRooms,
  gameSettings,
  gameState,
} from "$lib/store/game.svelte";
import { WebRTCConnection } from "./rtc.svelte";
import type {
  EventsFromClients,
  EventsToClients,
} from "$lib/../../vite-ws-dev";

export type SocketClient = Socket<EventsToClients, EventsFromClients>;

class SocketStore {
  // socket type should be using EventsFromClients and EventsToClients
  private socket: SocketClient | null = null;
  public isHost = false;
  public webrtc: WebRTCConnection | null = null;

  async connect(
    url: string,
    options?: Partial<ManagerOptions & SocketOptions>,
  ) {
    return new Promise<void>((resolve) => {
      this.socket = ioClient(url, options);
      this.webrtc = new WebRTCConnection();
      this.socket.on("connect", async () => {
        if (!this.socket?.id) return;
        gameState.userId = this.socket.id;
        this.addListeners();
        resolve();
      });
    });
  }

  async createRoom(userDetails?: UserDetails) {
    const s = this.socket;
    if (!s || !userDetails || !this.webrtc) return;
    await this.webrtc.createLocalConnection();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for all ice candidates to be generated
    const room = await s.emitWithAck("createRoom", userDetails, {
      sdp: this.webrtc.sdp,
    });
    this.isHost = true;
    gameState.room.roomId = room.roomId;
    gameState.room.players = [{ isHost: true, id: gameState.userId! }];
    gameState.isRoomConnecting = false;
    gameState.isPaused = false;
  }

  async seekRooms() {
    const s = this.socket;
    if (!s) return;
    const seekRooms = await s.emitWithAck("seekRooms");
    availableRooms.rooms = seekRooms;
    gameState.isRoomConnecting = false;
  }

  async joinRoom(roomId: string) {
    const s = this.socket;
    if (!s || !this.webrtc) return;
    const selectedRoom = await s.emitWithAck("selectRoom", roomId);
    await this.webrtc.joinRemoteConnection(selectedRoom);
    const joinedRoom = await s.emitWithAck("joinRoom", roomId, {
      sdp: this.webrtc.sdp,
    }, gameSettings.value);
    gameState.room.players = joinedRoom.users;
    gameState.room.messages = joinedRoom.messages;
    gameState.room.roomId = roomId;
    gameState.isRoomConnecting = false;
    gameState.isPaused = false;
  }

  changeName(name: string) {
    this.socket?.emit("name", name);
  }

  disconnect() {
    this.socket?.disconnect();
  }

  private addListeners() {
    const s = this.socket;
    if (!s) return;
    s.on("message", (message: Message) => this.onMessageReceived(message));
    s.on("roomState", (roomState: RoomStateChanged) => {
      switch (roomState.event) {
        case "user_joined":
          this.onUserJoined(roomState);
          break;
        case "user_left":
          this.onUserLeft(roomState);
          break;
        case "user_name_changed":
          this.onUserNameChanged(roomState);
          break;
      }
    });
  }

  private onMessageReceived = (message: Message) => {
    console.log("message received", message);
  };

  private onUserJoined(roomState: RoomStateChanged) {
    console.log("user joined", roomState);
    gameState.room.players = roomState.users;
    const user = roomState.users.find((u) => u.id === roomState.user);
    if (!user || !this.webrtc) return;
    this.webrtc.handleNewConnection(JSON.parse(user.rtcData!.sdp), user.id);
  }

  private onUserLeft(roomState: RoomStateChanged) {
    gameState.room.players = roomState.users;
    this.webrtc?.closePeerConnection(roomState.user);
  }

  private onUserNameChanged(roomState: RoomStateChanged) {
    gameState.room.players = roomState.users;
  }
}

export const socket = $state(new SocketStore());
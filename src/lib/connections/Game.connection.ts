/* eslint-disable @typescript-eslint/no-unused-vars */

import type { Message, RoomState, RoomStateChanged } from '$lib/@types/user.type';
import { availableRooms, gameState } from '$lib/store/game.svelte';
import { HostConnection } from './HostWebRTC.connection';
import { PlayerConnection } from './PlayerWebRTC.connection';

class GameConnectionHandler {
  private conn: EventSource | null = null;
  public isHost = false;
  public webrtc: HostConnection | PlayerConnection | null = null;

  async createRoom() {
    return new Promise<void>((resolve) => {
      this.conn = new EventSource('/api/game/host', { withCredentials: true });
      this.conn.onerror = (e) => {
        console.error('connection error', e);
        throw new Error('connection error');
      };
      this.conn.onmessage = (e) => {
        const roomState = JSON.parse(e.data) as RoomState;
        gameState.room.roomId = roomState.id;
        gameState.room.players = roomState.users;
        gameState.room.messages = roomState.messages;
        gameState.isPaused = false;
        gameState.isRoomConnecting = false;
        this.webrtc = new HostConnection(gameState.userId!, roomState.id);
        this.addListeners();
        resolve();
      };
    });
  }

  async seekRooms() {
    const response = await fetch('/api/game/rooms', { method: 'GET', credentials: 'include' });
    const rooms = await response.json();
    availableRooms.rooms = rooms;
  }

  async joinRoom(roomId: string) {
    this.webrtc = new PlayerConnection(gameState.userId!, roomId);
    // const s = this.conn;
    // if (!s || !this.webrtc) return;
    // const selectedRoom = await s.emitWithAck("selectRoom", roomId);
    // await this.webrtc.joinRemoteConnection(selectedRoom);
    // const joinedRoom = await s.emitWithAck("joinRoom", roomId, {
    //   sdp: this.webrtc.sdp,
    // }, gameSettings);
    // gameState.room.players = joinedRoom.users;
    // gameState.room.messages = joinedRoom.messages;
    // gameState.room.roomId = roomId;
    // gameState.isRoomConnecting = false;
    // gameState.isPaused = false;
  }

  changeUserDetails(name: string, color: string, userId: string) {
    if (!this.conn) return;
    // if this user is the host, update the room name
    if (this.isHost) {
      const data = { name, color };
      if (gameState.userId !== userId) {
        // @ts-expect-error userId is not defined in data yet
        data.userId = userId;
      }
      fetch('/api/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    } else {
      // send it to the host via webrtc
      this.webrtc?.updateUserInfoChange(name, color, userId);
    }
  }

  disconnect() {
    // this.conn?.disconnect();
  }

  private addListeners() {
    if (!this.conn) return;
    this.conn.addEventListener('newUser', (e) => {
      const data = JSON.parse(e.data);
      console.log('new user', data);
      (this.webrtc as HostConnection).handleNewPlayer(
        data.newUser.id,
        JSON.parse(data.newUser.sdp)
      );
    });
    // s.on("message", (message: Message) => this.onMessageReceived(message));
    // s.on("roomState", (roomState: RoomStateChanged) => {
    //   switch (roomState.event) {
    //     case "user_joined":
    //       this.onUserJoined(roomState);
    //       break;
    //     case "user_left":
    //       this.onUserLeft(roomState);
    //       break;
    //     case "user_name_changed":
    //       this.onUserNameChanged(roomState);
    //       break;
    //   }
    // });
  }

  private onMessageReceived = (message: Message) => {
    // console.log("message received", message);
  };

  private onUserJoined(roomState: RoomStateChanged) {
    // console.log("user joined", roomState);
    // gameState.room.players = roomState.users;
    // const user = roomState.users.find((u) => u.id === roomState.user);
    // if (!user || !this.webrtc) return;
    // this.webrtc.handleNewConnection(JSON.parse(user.rtcData!.sdp), user.id);
  }

  private onUserLeft(roomState: RoomStateChanged) {
    // gameState.room.players = roomState.users;
    // this.webrtc?.closePeerConnection(roomState.user);
  }

  private onUserNameChanged(roomState: RoomStateChanged) {
    // gameState.room.players = roomState.users;
  }
}

export const gameConnection = new GameConnectionHandler();

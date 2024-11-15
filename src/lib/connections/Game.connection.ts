import type { RoomState } from '$lib/@types/user.type';
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
    this.webrtc?.updateUserInfoChange(name, color, userId);
  }

  disconnect() {
    this.conn?.close();
  }

  private addListeners() {
    this.conn?.addEventListener('newUser', (e) => {
      const hostRTC = this.webrtc as HostConnection;
      const data = JSON.parse(e.data);
      hostRTC.handleNewPlayer(data.newUser.id, JSON.parse(data.newUser.sdp));
    });
  }
}

export const gameConnection = new GameConnectionHandler();

import type { RoomState, UserServer } from '$lib/@types/user.type';
import { availableRooms, gameState } from '$lib/store/game.svelte';
import { HostConnection } from './HostWebRTC.connection';
import { PlayerConnection } from './PlayerWebRTC.connection';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { dev } from '$app/environment';
import { WebRTCConnection } from './WebRTC.connection';
import { toast } from 'svelte-sonner';

class GameConnectionHandler {
  private conn: WebSocket | null = null;
  public isHost = false;
  public webrtc: HostConnection | PlayerConnection | null = null;

  async createRoom() {
    return new Promise<void>((resolve) => {
      const url = new URL(`${PUBLIC_BASE_URL}/api/game/host`);
      // change protocol to ws
      url.protocol = dev ? 'ws:' : 'wss:';
      this.conn = new WebSocket(url.toString());
      this.conn.onopen = () => {
        this.conn?.send(JSON.stringify({ type: 'roomState' }));
      };
      this.conn.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'roomState') {
          const content = data.content as RoomState;
          gameState.room.roomId = content.id;
          gameState.room.players = content.users;
          gameState.room.messages = content.messages;
          gameState.isPaused = false;
          gameState.isRoomConnecting = false;
          this.webrtc = new HostConnection(gameState.userId!, content.id);
          resolve();
        } else if (data.type === 'newUser') {
          type NewUserContent = RoomState & { newUser: UserServer & { sdp: string } };
          const content = data.content as NewUserContent;
          console.log('new user', data);
          const offer = JSON.parse(content.newUser.sdp);
          (this.webrtc as HostConnection).handleNewPlayer(content.newUser.id, offer);
        }
      };
    });
  }

  async seekRooms() {
    const response = await fetch(`${PUBLIC_BASE_URL}/api/game/rooms`, {
      method: 'GET',
      credentials: 'include'
    });
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

  async changeUserDetails(name: string, color: string, userId: string) {
    try {
      if (this.webrtc) {
        await this.webrtc.updateUserInfoChange(name, color, userId);
      } else {
        await WebRTCConnection.sendUserInfoChange(name, color, userId);
      }
      toast.success('User info updated successfully');
    } catch (error) {
      console.error('Error updating user info', error);
    }
  }

  disconnect() {
    this.conn?.close();
  }
}

export const gameConnection = new GameConnectionHandler();

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
  private _mediaStream: MediaStream | null = null;
  public webrtc: HostConnection | PlayerConnection | null = null;

  async createRoom() {
    return new Promise<void>((resolve) => {
      const url = new URL(`${PUBLIC_BASE_URL}/api/game/host`);
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
          // should pass this_mediaStream as a constructor
          this.webrtc = new HostConnection(gameState.userId!, content.id);
          resolve();
        } else if (data.type === 'newUser') {
          type NewUserContent = RoomState & { newUser: UserServer & { sdp: string } };
          const content = data.content as NewUserContent;
          const offer = JSON.parse(content.newUser.sdp);
          // should pass this_mediaStream as a constructor
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

  async handleMicToggle(mic: boolean) {
    if (mic) {
      this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.webrtc?.handleMyMediaStream(this._mediaStream);
    } else {
      this._mediaStream?.getTracks().forEach((track) => {
        track.stop();
      });
      this._mediaStream = null;
    }
    gameState.room.players = gameState.room.players?.map((player) => {
      if (player.id === gameState.userId) {
        player.mic = mic;
      }
      return player;
    });
  }

  disconnect() {
    this.conn?.close();
  }
}

export const gameConnection = new GameConnectionHandler();

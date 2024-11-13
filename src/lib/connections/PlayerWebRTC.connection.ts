import type { RoomState } from '../@types/user.type';
import { gameState } from '../store/game.svelte';
import { WebRTCConnection } from './WebRTC.connection';

export class PlayerConnection extends WebRTCConnection {
  private peerConnection: RTCPeerConnection;
  private playerSdp: string | null = null;
  private isIceCandidateHandled = false;
  constructor(playerId: string, roomId: string) {
    super('player', playerId, roomId);
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
            // More STUN/TURN servers here if needed
          ]
        }
      ]
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.playerSdp = JSON.stringify(this.peerConnection.localDescription);
        // wait for all ice candidates to be generated before sending the offer
        setTimeout(() => {
          if (!this.isIceCandidateHandled) {
            this.isIceCandidateHandled = true;
            this.handleIceCandidate();
          }
        }, 1000);
      }
    };
    this.setupConnection();
  }

  private async setupConnection() {
    this.setupDataChannel('player-data');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
  }

  private setupDataChannel(label: string) {
    const dataChannel = this.peerConnection.createDataChannel(label);

    dataChannel.onopen = () => {
      console.log(`${this.role} data channel open`);
      gameState.isRoomConnecting = false;
      gameState.isPaused = false;
    };
    dataChannel.onmessage = (event) => this.handleDataChannelMessage(event.data);
    this.peerConnection.channel = dataChannel;
  }

  protected async handleIceCandidate() {
    console.log('sending offer sdp to host');
    const response = await fetch(`/api/game/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdp: this.playerSdp,
        roomId: this.roomId
      })
    });
    const roomState: RoomState = await response.json();
    const hostUser = roomState.users.find((user) => user.is_host);
    // @ts-expect-error sdp is not defined in hostUser yet
    if (!hostUser || !hostUser?.sdp) {
      throw new Error('Host user not found');
    }
    gameState.room.players = roomState.users;
    gameState.room.messages = roomState.messages;
    gameState.room.roomId = this.roomId;
    await this.peerConnection.setRemoteDescription(
      // @ts-expect-error sdp is not defined in hostUser yet
      new RTCSessionDescription(hostUser.sdp as RTCSessionDescriptionInit)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendMessage(message: string): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendPositionUpdate(x: number, y: number, z: number): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateUserInfoChange(name: string, color: string, userId: string): void {
    throw new Error('Method not implemented.');
  }
}

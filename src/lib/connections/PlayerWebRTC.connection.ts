import { PUBLIC_BASE_URL } from '$env/static/public';
import type { RoomState } from '$lib/@types/user.type';
import { gameState } from '$lib/store/game.svelte';
import type { RTCMessage } from '../@types/Rtc.type';
import { WebRTCConnection } from './WebRTC.connection';

export class PlayerConnection extends WebRTCConnection {
  /** host peer connection */
  private peerConnection: RTCPeerConnection;
  private playerSdp: string | null = null;
  private isIceCandidateHandled = false;
  constructor(playerId: string, roomId: string) {
    super('player', playerId, roomId);
    window.client = this;
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
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
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
    this.peerConnection.ontrack = (event) => {
      console.log('received track from host', event);
      // this.mediaStream = new MediaStream();
      // this.mediaStream.addTrack(event.track);
    };

    this.peerConnection.onnegotiationneeded = async (event) => {
      console.log('negotiation needed', event, this);
      // create offer when negotiation is needed and send it to the host using signalling channel
      // await this.setupConnection();
      // this.peerConnection.channel?.send(
      //   JSON.stringify({
      //     type: 'video-offer',
      //     sdp: this.playerSdp
      //   })
      // );
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
      this.hasDataChannel = true;
      gameState.isRoomConnecting = false;
      gameState.isPaused = false;
    };
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.event) {
        case 'userInfoChange':
          gameState.room.players = message.room.players;
          gameState.room.messages = message.room.messages;
          break;
        // case 'chatMessage':
        //   gameState.room.messages.push({
        //     message: message.message,
        //     from: message.from,
        //     time: message.time
        //   });
        //   break;
        case 'positionUpdate':
          gameState.room.players = gameState.room.players?.map((player) => {
            if (player.id === message.from) {
              player.position = message.position;
            }
            return player;
          });
          break;
        case 'userLeft':
          gameState.room.players = gameState.room.players?.filter(
            (player) => player.id !== message.from
          );
          break;
        case 'userJoined':
          gameState.room.players?.push(message.user);
          break;
        default:
          break;
      }
    };
    dataChannel.onclose = () => {
      console.log(`${this.role} data channel closed. reloading page..`);
      window.location.reload();
    };
    this.peerConnection.channel = dataChannel;
  }

  protected async handleIceCandidate() {
    const response = await fetch(`${PUBLIC_BASE_URL}/api/game/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

  public sendMessage(message: string): void {
    this.peerConnection.channel?.send(
      JSON.stringify({
        event: 'chatMessage',
        message,
        from: gameState.userId,
        time: new Date().getTime()
      } satisfies RTCMessage)
    );
  }

  public sendPositionUpdate(x: number, y: number, z: number): void {
    this.peerConnection.channel?.send(
      JSON.stringify({
        event: 'positionUpdate',
        position: [x, y, z],
        from: gameState.userId,
        time: new Date().getTime()
      } satisfies RTCMessage)
    );
  }

  public override async updateUserInfoChange(name: string, color: string, userId: string) {
    const updatedUser = await super.updateUserInfoChange(name, color, userId);
    this.peerConnection.channel?.send(
      JSON.stringify({
        event: 'userInfoChange',
        user: updatedUser,
        room: gameState.room,
        from: gameState.userId,
        time: new Date().getTime()
      } satisfies RTCMessage)
    );
    return updatedUser;
  }
  /**
   * non host player should send their track to the host
   */
  public handleMyMediaStream(stream: MediaStream): void {
    console.log('sending track to host', stream);
    const audioTrack = stream.getAudioTracks()[0];
    audioTrack.enabled = true;
    this.mediaStream = stream;
    // don't add new track, just replace the existing track
    this.peerConnection.getSenders().forEach((sender) => {
      console.log('replacing track in peer connection', sender);
      sender.replaceTrack(audioTrack);
      
    });
  }
}

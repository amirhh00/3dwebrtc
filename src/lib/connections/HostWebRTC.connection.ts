import { WebRTCConnection } from './WebRTC.connection';

export class HostConnection extends WebRTCConnection {
  private players: Map<string, RTCPeerConnection> = new Map();

  constructor(playerId: string, roomId: string) {
    super('host', playerId, roomId);
  }

  public async handleNewPlayer(playerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const newPeerConnection = this.createNewPeerConnection(playerId);
    await newPeerConnection.setRemoteDescription(offer);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
    // Notify existing players of the new player joining
    this.broadcastToPlayers(`Player ${playerId} joined`);
  }

  private createNewPeerConnection(playerId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({
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
    let isIceCandidateHandled = false;
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && !isIceCandidateHandled) {
        isIceCandidateHandled = true;
        const sdp = JSON.stringify(peerConnection.localDescription);
        const body = JSON.stringify({
          sdp,
          playerId
        });
        console.log(`Sending offer SDP to player ${playerId}`, body);
        fetch('/api/game/host', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
      }
    };

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (message) => {
        console.log(`Received message from player ${playerId}: ${message}`);
      };
      dataChannel.onopen = () => {
        console.log(`Data channel opened with player ${playerId}`);
        fetch('/api/game/host', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomId,
            playerId
          })
        });
      };
      peerConnection.channel = dataChannel;
    };
    this.players.set(playerId, peerConnection);
    return peerConnection;
  }

  private broadcastToPlayers(message: string) {
    this.players.forEach((peerConnection) => {
      peerConnection.channel?.send(message);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendMessage(message: string): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendPositionUpdate(x: number, y: number, z: number): void {
    // throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateUserInfoChange(name: string, color: string, userId: string): void {
    throw new Error('Method not implemented.');
  }
}

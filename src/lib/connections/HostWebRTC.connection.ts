import { gameState, type UserClient } from '$lib/store/game.svelte';
import type { RTCMessage } from '$lib/@types/Rtc.type';
import { WebRTCConnection } from './WebRTC.connection';

// class PlayersPeer {
//   playerId: string;
//   peerConnection: RTCPeerConnection;
//   channel: RTCDataChannel;

//   constructor(playerId: string, peerConnection: RTCPeerConnection, channel: RTCDataChannel) {
//     this.playerId = playerId;
//     this.peerConnection = peerConnection;
//     this.channel = channel;
//   }

//   public addEventListeners() {
//     this.peerConnection.ondatachannel = (event) => {
//       const dataChannel = event.channel;
//       this.channel = dataChannel;
//       this.addChannelEventListeners();
//     };
//   }
// }

interface customWindow extends Window {
  host?: HostConnection;
}

declare const window: customWindow;

export class HostConnection extends WebRTCConnection {
  // private players: PlayersPeer[] = [];
  private players = new Map<string, RTCPeerConnection>();

  constructor(playerId: string, roomId: string) {
    super('host', playerId, roomId);
    window.host = this;
  }

  public async handleNewPlayer(playerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const newPeerConnection = this.createNewPeerConnection(playerId);
    await newPeerConnection.setRemoteDescription(offer);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
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
        fetch('/api/game/host', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
      }
    };

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      peerConnection.channel = dataChannel;
      this.addEventListenersToNewPeer(dataChannel, playerId);
    };
    // this.players.push(new PlayersPeer(playerId, peerConnection, peerConnection.createDataChannel('host-data')));
    this.players.set(playerId, peerConnection);
    return peerConnection;
  }

  private addEventListenersToNewPeer(dataChannel: RTCDataChannel, playerId: string) {
    dataChannel.onopen = async () => {
      this.hasDataChannel = true;
      const newAddedUserToDbRes = await fetch('/api/game/host', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roomId: this.roomId,
          playerId
        })
      });
      const newAddedUserToDb: UserClient = await newAddedUserToDbRes.json();
      gameState.room.players?.push(newAddedUserToDb);
      // send room state to all players
      this.broadcastToPlayers({
        event: 'userJoined',
        from: gameState.userId,
        user: newAddedUserToDb,
        room: gameState.room,
        time: new Date().getTime()
      });
    };

    dataChannel.onclose = this.handleRemovePlayer.bind(this, playerId);

    dataChannel.onmessage = (message) => {
      // console.log(`Host: Received message from player ${playerId}: `, message.data);
      const parsedRtcMessage = JSON.parse(message.data) as RTCMessage;
      switch (parsedRtcMessage.event) {
        case 'positionUpdate':
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.position = (parsedRtcMessage as RTCMessage<'positionUpdate'>).position;
              break;
            }
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        case 'userInfoChange':
          // gameState.room.players = parsedRtcMessage.room.players;
          // gameState.room.messages = parsedRtcMessage.room.messages;
          break;
        default:
          break;
      }
    };
  }

  private broadcastToPlayers(msg?: RTCMessage, options?: { excludePlayerId?: string }) {
    this.players.forEach((peerConnection, playerId) => {
      if (
        options?.excludePlayerId &&
        options.excludePlayerId === playerId &&
        peerConnection.channel?.readyState !== 'open'
      ) {
        return;
      }
      try {
        peerConnection.channel?.send(JSON.stringify(msg));
      } catch {
        // this.handleRemovePlayer(playerId);
      }
    });
  }

  private async handleRemovePlayer(playerId: string) {
    const disconnectedUserRes = await fetch('/api/game/host', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        roomId: this.roomId,
        playerId
      })
    });
    const disconnectedUser: UserClient = await disconnectedUserRes.json();
    // const newRemovedUser: UserClient = await newRemovedUserRes.json();
    this.players.delete(playerId);
    if (this.players.size === 0) this.hasDataChannel = false;
    gameState.room.players = gameState.room.players?.filter((user) => user.id !== playerId);
    this.broadcastToPlayers(
      {
        event: 'userLeft',
        from: gameState.userId,
        user: disconnectedUser,
        room: gameState.room,
        time: new Date().getTime()
      },
      { excludePlayerId: playerId }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public sendMessage(message: string): void {
    throw new Error('Method not implemented.');
  }

  public sendPositionUpdate(x: number, y: number, z: number): void {
    this.broadcastToPlayers({
      event: 'positionUpdate',
      from: gameState.userId,
      position: [x, y, z],
      time: new Date().getTime()
    });
  }

  public override async updateUserInfoChange(name: string, color: string, userId: string) {
    const updatedUser = await super.updateUserInfoChange(name, color, userId);
    // broadcast to all players
    this.broadcastToPlayers({
      from: gameState.userId,
      event: 'userInfoChange',
      user: updatedUser,
      room: gameState.room,
      time: new Date().getTime()
    });
    return updatedUser;
  }
}

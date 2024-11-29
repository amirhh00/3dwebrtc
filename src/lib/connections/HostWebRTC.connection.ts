import { gameState, type UserClient } from '$lib/store/game.svelte';
import type { RTCMessage } from '$lib/@types/Rtc.type';
import { WebRTCConnection } from './WebRTC.connection';
import { PUBLIC_BASE_URL } from '$env/static/public';

export class HostConnection extends WebRTCConnection {
  // private players: PlayersPeer[] = [];
  private players = new Map<string, RTCPeerConnection>();
  private mediaStreams = new Map<string, MediaStream>();
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
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    let isIceCandidateHandled = false;
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && !isIceCandidateHandled) {
        isIceCandidateHandled = true;
        const sdp = peerConnection.localDescription?.toJSON();
        const body = JSON.stringify({
          sdp,
          playerId
        });
        fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
          method: 'POST',
          credentials: 'include',
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

    peerConnection.ontrack = async (event) => {
      console.log('Host: Received track from player', event, playerId, gameState.room.players);
      const mediaStream = new MediaStream();
      mediaStream.addTrack(event.track);
      // wait to make sure the user has been added to the roomState
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const user = gameState.room.players?.find((player) => player.id === playerId);
      if (user) {
        user.stream = mediaStream;
        user.mic = true;
        console.log('Host: Added stream to player', user);
      }
      this.mediaStreams.set(playerId, mediaStream);
      // const audio = document.createElement('audio');
      // audio.id = playerId;
      // audio.srcObject = mediaStream;
      // document.body.appendChild(audio);
      // audio.play();
    };

    peerConnection.onnegotiationneeded = async (event) => {
      console.log('Host: negotiation needed', event);
    }

    // this.players.push(new PlayersPeer(playerId, peerConnection, peerConnection.createDataChannel('host-data')));
    this.players.set(playerId, peerConnection);
    return peerConnection;
  }

  private addEventListenersToNewPeer(dataChannel: RTCDataChannel, playerId: string) {
    dataChannel.onopen = async () => {
      this.hasDataChannel = true;
      const newAddedUserToDbRes = await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roomId: this.roomId,
          playerId
        })
      });
      const newAddedUserToDb: UserClient = await newAddedUserToDbRes.json();
      if (this.mediaStreams.has(playerId)) {
        console.log('user has already opened an audio track, so replacing now.. ', playerId);
        newAddedUserToDb.stream = this.mediaStreams.get(playerId);
        newAddedUserToDb.mic = true;
      }
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
    const disconnectedUserRes = await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
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

  /**
   * host should just add their media stream to all players tracks
   */
  public handleMyMediaStream(stream: MediaStream): void {
    this.players.forEach((peerConnection) => {
      const audioSender = peerConnection
        .getSenders()
        .find((sender) => sender.track?.kind === 'audio');
      if (audioSender) {
        console.log('replacing track in peer connection', stream);
        audioSender.replaceTrack(stream.getAudioTracks()[0]);
      }
    });
  }
}

import { gameState, type UserClient } from '$lib/store/game.svelte';
import type {
  MeshSignalOutbound,
  MicToggle,
  RTCMessage,
  positionUpdate
} from '$lib/@types/Rtc.type';
import { WebRTCConnection } from './WebRTC.connection';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { DEFAULT_RTC_CONFIGURATION, waitForIceGatheringComplete } from './webrtc-ice';

export class HostConnection extends WebRTCConnection {
  private players = new Map<string, RTCPeerConnection>();
  /** One cloned audio track per guest PC — a single track cannot be attached to multiple senders. */
  private hostMicClones = new Map<string, MediaStreamTrack>();
  constructor(playerId: string, roomId: string) {
    super('host', playerId, roomId);
    window.host = this;
  }

  public async handleNewPlayer(playerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const newPeerConnection = this.createNewPeerConnection(playerId);
    await newPeerConnection.setRemoteDescription(offer);
    const answer = await newPeerConnection.createAnswer();
    await newPeerConnection.setLocalDescription(answer);
    await waitForIceGatheringComplete(newPeerConnection);
    const sdp = newPeerConnection.localDescription?.toJSON();
    await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp, playerId })
    });
  }

  private createNewPeerConnection(playerId: string): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      peerConnection.channel = dataChannel;
      this.addEventListenersToNewPeer(dataChannel, playerId);
    };

    peerConnection.ontrack = (event) => {
      const mediaStream = event.streams[0] ?? new MediaStream([event.track]);
      this.mediaStreams.set(playerId, mediaStream);
    };

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
      // if (this.mediaStreams.has(playerId)) {
      //   console.log('user has already opened an audio track, so replacing now.. ', playerId);
      //   newAddedUserToDb.stream = this.mediaStreams.get(playerId);
      //   newAddedUserToDb.mic = false;
      // }
      gameState.room.players = [...(gameState.room.players ?? []), newAddedUserToDb];
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
      if (parsedRtcMessage.event === 'meshSignal' && 'to' in parsedRtcMessage) {
        const relay = parsedRtcMessage as MeshSignalOutbound;
        if (relay.to !== playerId && this.players.has(relay.to)) {
          const inbound: RTCMessage = {
            event: 'meshSignal',
            from: playerId,
            body: relay.body,
            time: relay.time
          };
          this.players.get(relay.to)?.channel?.send(JSON.stringify(inbound));
        }
        return;
      }
      switch (parsedRtcMessage.event) {
        case 'positionUpdate':
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.position = (parsedRtcMessage as positionUpdate).position;
              break;
            }
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        case 'userInfoChange':
          // gameState.room.players = parsedRtcMessage.room.players;
          // gameState.room.messages = parsedRtcMessage.room.messages;
          break;
        case 'micToggle':
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.mic = (parsedRtcMessage as MicToggle).mic;
              player.stream = player.mic ? this.mediaStreams.get(playerId) : undefined;
              break;
            }
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        default:
          break;
      }
    };
  }

  private broadcastToPlayers(msg?: RTCMessage, options?: { excludePlayerId?: string }) {
    this.players.forEach((peerConnection, playerId) => {
      if (options?.excludePlayerId && options.excludePlayerId === playerId) {
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
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    this.clearMicrophoneTracks();
    this.players.forEach((peerConnection, pid) => {
      const clone = track.clone();
      this.hostMicClones.set(pid, clone);
      const audioSender = peerConnection
        .getSenders()
        .find((sender) => sender.track === null || sender.track?.kind === 'audio');
      if (audioSender) {
        void audioSender.replaceTrack(clone);
      }
    });
  }

  public override clearMicrophoneTracks(): void {
    this.hostMicClones.forEach((t) => t.stop());
    this.hostMicClones.clear();
    this.players.forEach((peerConnection) => {
      const audioSender = peerConnection
        .getSenders()
        .find((sender) => sender.track === null || sender.track?.kind === 'audio');
      void audioSender?.replaceTrack(null);
    });
  }
}

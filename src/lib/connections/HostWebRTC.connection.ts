import { gameState, type UserClient } from '$lib/store/game.svelte';
import type {
  ChatMessage,
  MeshSignalOutbound,
  MicToggle,
  RTCMessage,
  RoomStateChanged,
  positionUpdate
} from '$lib/@types/Rtc.type';
import {
  displayName,
  logChat,
  logMic,
  logPlayerJoined,
  logPlayerLeft,
  logRecolor,
  logRename
} from '$lib/store/gameEventLog.svelte';
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
      logPlayerJoined(newAddedUserToDb);
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
        case 'userInfoChange': {
          const msg = parsedRtcMessage as RoomStateChanged;
          if (msg.user.id !== playerId) break;
          const oldRow = gameState.room.players?.find((p) => p.id === msg.user.id);
          gameState.room.players = gameState.room.players?.map((p) =>
            p.id === msg.user.id
              ? { ...p, ...msg.user, stream: p.stream, position: p.position, mic: p.mic }
              : p
          );
          const updated = gameState.room.players?.find((p) => p.id === msg.user.id);
          if (oldRow && updated) {
            if ((oldRow.name ?? '') !== (updated.name ?? '')) {
              logRename(updated, displayName(oldRow), displayName(updated));
            }
            if ((oldRow.color ?? '').trim() !== (updated.color ?? '').trim()) {
              logRecolor(
                updated,
                (oldRow.color || '').trim() || '#888888',
                (updated.color || '').trim() || '#888888'
              );
            }
          }
          this.broadcastToPlayers({
            event: 'userInfoChange',
            user: updated ?? msg.user,
            room: gameState.room,
            from: playerId,
            time: Date.now()
          });
          break;
        }
        case 'micToggle':
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.mic = (parsedRtcMessage as MicToggle).mic;
              player.stream = player.mic ? this.mediaStreams.get(playerId) : undefined;
              break;
            }
          }
          {
            const row = gameState.room.players?.find((p) => p.id === playerId);
            if (row) logMic(row, (parsedRtcMessage as MicToggle).mic ?? false);
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        case 'chatMessage': {
          const chat = parsedRtcMessage as ChatMessage;
          if (chat.from !== playerId) break;
          const actor = gameState.room.players?.find((p) => p.id === playerId);
          logChat(actor, chat.message, chat.time);
          this.broadcastToPlayers(chat);
          break;
        }
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
    logPlayerLeft(disconnectedUser);
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

  public sendMessage(message: string): void {
    const chat: ChatMessage = {
      event: 'chatMessage',
      message,
      from: this.userId,
      time: Date.now()
    };
    const actor = gameState.room.players?.find((p) => p.id === this.userId);
    logChat(actor, message, chat.time);
    this.broadcastToPlayers(chat);
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
    const oldRow = gameState.room.players?.find((p) => p.id === userId);
    const updatedUser = await super.updateUserInfoChange(name, color, userId);
    gameState.room.players = gameState.room.players?.map((p) =>
      p.id === userId ? { ...p, ...updatedUser, stream: p.stream, position: p.position, mic: p.mic } : p
    );
    const row = gameState.room.players?.find((p) => p.id === userId);
    if (oldRow && row) {
      if ((oldRow.name ?? '') !== (row.name ?? '')) {
        logRename(row, displayName(oldRow), displayName(row));
      }
      if ((oldRow.color ?? '').trim() !== (row.color ?? '').trim()) {
        logRecolor(
          row,
          (oldRow.color || '').trim() || '#888888',
          (row.color || '').trim() || '#888888'
        );
      }
    }
    this.broadcastToPlayers({
      from: this.userId,
      event: 'userInfoChange',
      user: row ?? updatedUser,
      room: gameState.room,
      time: new Date().getTime()
    });
    return updatedUser;
  }

  /** Notify all guests when the host toggles microphone (UI + mute state). */
  public broadcastHostMicState(mic: boolean): void {
    this.broadcastToPlayers({
      event: 'micToggle',
      mic,
      from: this.userId,
      time: Date.now()
    });
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

import { gameState, type UserClient } from '$lib/store/game.svelte';
import type {
  ChatMessage,
  MeshSignalOutbound,
  MicToggle,
  RTCMessage,
  RoomStateChanged,
  RoomStateSync,
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
    console.log(`[HOST] 🎤 handleNewPlayer called for ${playerId}`);
    const newPeerConnection = this.createNewPeerConnection(playerId);
    console.log(`[HOST] ✅ Peer connection created for ${playerId}`);

    await newPeerConnection.setRemoteDescription(offer);
    console.log(`[HOST] ✅ Remote description set for ${playerId}`);

    const answer = await newPeerConnection.createAnswer();
    console.log(`[HOST] ✅ Answer created for ${playerId}`);

    await newPeerConnection.setLocalDescription(answer);
    console.log(`[HOST] ✅ Local description set for ${playerId}`);

    await waitForIceGatheringComplete(newPeerConnection);
    console.log(`[HOST] ✅ ICE gathering complete for ${playerId}`);

    const sdp = newPeerConnection.localDescription?.toJSON();
    console.log(`[HOST] 📤 Sending answer SDP to server for ${playerId}`);

    await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp, playerId })
    });
    console.log(`[HOST] ✅ Answer sent to server for ${playerId}`);
  }

  private createNewPeerConnection(playerId: string): RTCPeerConnection {
    console.log(`[HOST] 🔗 Creating RTCPeerConnection for ${playerId}`);
    const peerConnection = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);

    // Add audio transceiver so we can send/receive audio from this player
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    console.log(`[HOST] ✅ Added audio transceiver for ${playerId}`);

    peerConnection.ondatachannel = (event) => {
      console.log(`[HOST] 📡 Data channel received from ${playerId}`);
      const dataChannel = event.channel;
      peerConnection.channel = dataChannel;
      this.addEventListenersToNewPeer(dataChannel, playerId);
    };

    peerConnection.ontrack = (event) => {
      console.log(`[HOST] 🔊 Received track from ${playerId}:`, event.track.kind, event.track.id);
      const mediaStream = event.streams[0] ?? new MediaStream([event.track]);
      this.mediaStreams.set(playerId, mediaStream);
      console.log(
        `[HOST] ✅ Media stream saved for ${playerId}`,
        mediaStream.id,
        'tracks:',
        mediaStream.getTracks().length
      );
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `[HOST] 🔄 Connection state changed for ${playerId}:`,
        peerConnection.connectionState
      );
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        `[HOST] 🧊 ICE connection state for ${playerId}:`,
        peerConnection.iceConnectionState
      );
    };

    this.players.set(playerId, peerConnection);
    console.log(`[HOST] ✅ Peer connection stored. Total players: ${this.players.size}`);
    return peerConnection;
  }

  private addEventListenersToNewPeer(dataChannel: RTCDataChannel, playerId: string) {
    console.log(`[HOST] 📡 Adding event listeners to data channel for ${playerId}`);

    dataChannel.onopen = async () => {
      console.log(`[HOST] ✅ DATA CHANNEL OPENED for ${playerId}`);
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
      console.log(
        `[HOST] ✅ Player added to database:`,
        newAddedUserToDb.id,
        newAddedUserToDb.name
      );

      gameState.room.players = [...(gameState.room.players ?? []), newAddedUserToDb];
      logPlayerJoined(newAddedUserToDb);

      // If host has already enabled their microphone, attach it to this new player
      if (this.hostMicClones.size > 0) {
        console.log(`[HOST] 🎙️ Host has active mic, attaching to new player ${playerId}`);
        const peerConnection = this.players.get(playerId);
        if (peerConnection) {
          const hostTrack = Array.from(this.hostMicClones.values())[0];
          if (hostTrack) {
            const clone = hostTrack.clone();
            this.hostMicClones.set(playerId, clone);
            const audioSender = peerConnection
              .getSenders()
              .find((sender) => sender.track === null || sender.track?.kind === 'audio');
            if (audioSender) {
              console.log(`[HOST] ✅ Attached existing host mic to ${playerId}`);
              void audioSender.replaceTrack(clone).catch((e) => {
                console.error(`[HOST] ❌ Failed to attach mic to ${playerId}:`, e);
              });
            }
          }
        }
      }

      // Send full room state to the newly joined player so they know everyone's mic status
      console.log(`[HOST] 📤 Sending room state sync to ${playerId}`);
      this.sendRoomStateToPlayer(playerId);

      // send room state to all players except the one who just joined (they already got it via roomStateSync)
      console.log(`[HOST] 📢 Broadcasting userJoined to all players except ${playerId}`);
      this.broadcastToPlayers(
        {
          event: 'userJoined',
          from: gameState.userId,
          user: newAddedUserToDb,
          room: gameState.room,
          time: new Date().getTime()
        },
        { excludePlayerId: playerId }
      );
    };

    dataChannel.onclose = () => {
      console.log(`[HOST] ❌ DATA CHANNEL CLOSED for ${playerId}`);
      this.handleRemovePlayer(playerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`[HOST] ⚠️ Data channel error for ${playerId}:`, error);
    };

    dataChannel.onmessage = (message) => {
      const parsedRtcMessage = JSON.parse(message.data) as RTCMessage;
      // console.log(`[HOST] 📨 Message from ${playerId}:`, parsedRtcMessage.event);

      if (parsedRtcMessage.event === 'meshSignal' && 'to' in parsedRtcMessage) {
        const relay = parsedRtcMessage as MeshSignalOutbound;
        if (relay.to !== playerId && this.players.has(relay.to)) {
          console.log(`[HOST] 🔀 Relaying mesh signal from ${playerId} to ${relay.to}`);
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
          // console.log(`[HOST] 📍 Position update from ${playerId}`);
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.position = (parsedRtcMessage as positionUpdate).position;
              break;
            }
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        case 'userInfoChange': {
          console.log(`[HOST] 👤 User info change from ${playerId}`);
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
          console.log(
            `[HOST] 🔊 Mic toggle from ${playerId}:`,
            (parsedRtcMessage as MicToggle).mic
          );
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.mic = (parsedRtcMessage as MicToggle).mic;
              player.stream = player.mic ? this.mediaStreams.get(playerId) : undefined;
              console.log(
                `[HOST] ✅ Updated ${playerId} mic state. Has stream: ${!!player.stream}`
              );
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
          console.log(`[HOST] 💬 Chat message from ${playerId}`);
          const chat = parsedRtcMessage as ChatMessage;
          if (chat.from !== playerId) break;
          const actor = gameState.room.players?.find((p) => p.id === playerId);
          logChat(actor, chat.message, chat.time);
          this.broadcastToPlayers(chat);
          break;
        }
        default:
          console.log(`[HOST] ❓ Unknown message type from ${playerId}:`, parsedRtcMessage.event);
          break;
      }
    };
  }

  private broadcastToPlayers(msg?: RTCMessage, options?: { excludePlayerId?: string }) {
    // console.log(
    //   `[HOST] 📢 Broadcasting to ${this.players.size} players (excluding: ${options?.excludePlayerId || 'none'})`
    // );
    this.players.forEach((peerConnection, playerId) => {
      if (options?.excludePlayerId && options.excludePlayerId === playerId) {
        // console.log(`[HOST] ⏭️  Skipping excluded player ${playerId}`);
        return;
      }
      try {
        if (peerConnection.channel?.readyState === 'open') {
          peerConnection.channel?.send(JSON.stringify(msg));
          // console.log(`[HOST] ✅ Sent to ${playerId}`);
        } else {
          console.warn(
            `[HOST] ⚠️ Channel not open for ${playerId}:`,
            peerConnection.channel?.readyState
          );
        }
      } catch (e) {
        console.error(`[HOST] ❌ Error sending to ${playerId}:`, e);
      }
    });
  }

  private sendToPlayer(playerId: string, msg?: RTCMessage) {
    try {
      if (this.players.get(playerId)?.channel?.readyState === 'open') {
        this.players.get(playerId)?.channel?.send(JSON.stringify(msg));
        console.log(`[HOST] ✅ Sent message to specific player ${playerId}:`, msg?.event);
      } else {
        console.warn(
          `[HOST] ⚠️ Cannot send to ${playerId}: channel is ${this.players.get(playerId)?.channel?.readyState}`
        );
      }
    } catch (e) {
      console.error(`[HOST] ❌ Error sending to player ${playerId}:`, e);
    }
  }

  private sendRoomStateToPlayer(playerId: string) {
    if (!gameState.room.players) {
      console.warn(`[HOST] ⚠️ No players in room state when trying to sync to ${playerId}`);
      return;
    }

    // Send current state of all players (with mic status) to the newly joined player
    const playerSummary = gameState.room.players.map((p) => `${p.name}(mic:${p.mic})`).join(', ');
    console.log(`[HOST] 📤 Sending room state sync to ${playerId}. Players: ${playerSummary}`);

    const stateMessage: RoomStateSync = {
      event: 'roomStateSync',
      from: gameState.userId,
      players: gameState.room.players.map((p) => ({
        ...p,
        stream: undefined // Don't send actual streams, just metadata
      })),
      time: Date.now()
    };

    this.sendToPlayer(playerId, stateMessage);
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
      p.id === userId
        ? { ...p, ...updatedUser, stream: p.stream, position: p.position, mic: p.mic }
        : p
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
    console.log(`[HOST] 🎤 Broadcasting host mic state:`, mic, `to ${this.players.size} players`);
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
    console.log(`[HOST] 🎤 handleMyMediaStream called, stream id:`, stream.id);
    const track = stream.getAudioTracks()[0];
    console.log(`[HOST] 🔊 Audio track:`, track?.id, 'enabled:', track?.enabled);
    if (!track) {
      console.warn(`[HOST] ⚠️ No audio tracks found in stream!`);
      return;
    }

    this.clearMicrophoneTracks();
    console.log(`[HOST] ✅ Cleared previous mic tracks`);

    this.players.forEach((peerConnection, pid) => {
      console.log(`[HOST] 🔗 Attaching mic track to peer ${pid}`);
      const clone = track.clone();
      this.hostMicClones.set(pid, clone);
      const audioSender = peerConnection
        .getSenders()
        .find((sender) => sender.track === null || sender.track?.kind === 'audio');
      if (audioSender) {
        console.log(`[HOST] ✅ Found audio sender for ${pid}, replacing track`);
        void audioSender
          .replaceTrack(clone)
          .then(() => {
            console.log(`[HOST] ✅ Successfully replaced track for ${pid}`);
          })
          .catch((e) => {
            console.error(`[HOST] ❌ Failed to replace track for ${pid}:`, e);
          });
      } else {
        console.warn(`[HOST] ⚠️ No audio sender found for ${pid}`);
      }
    });
    console.log(`[HOST] ✅ Attached mic to ${this.players.size} players`);
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

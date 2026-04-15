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
  /** Store audio senders for each player so we can attach tracks to them later */
  private playerAudioSenders = new Map<string, RTCRtpSender>();
  /** Keep audio contexts alive to prevent GC from invalidating dummy tracks */
  private dummyAudioContexts = new Map<
    string,
    {
      context: AudioContext;
      oscillator: OscillatorNode;
      destination: MediaStreamAudioDestinationNode;
    }
  >();

  constructor(playerId: string, roomId: string) {
    super('host', playerId, roomId);
    window.host = this;
  }

  public async handleNewPlayer(playerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    // Create dummy track first
    const dummyTrack = await this.createDummyAudioTrack(playerId);
    if (!dummyTrack) {
      console.error(`[HOST] ❌ Failed to create dummy track for ${playerId}`);
      return;
    }

    const newPeerConnection = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);

    // Process the offer — browser automatically creates a recvonly transceiver for the audio m-line
    await newPeerConnection.setRemoteDescription(offer);

    // ✅ FIX: Reuse the transceiver the browser just created from the offer instead of adding a
    // new orphaned one. Adding a second transceiver after setRemoteDescription means it has no
    // matching m-line in the offer, so createAnswer() leaves the first transceiver as recvonly
    // and the guest never receives a=sendrecv → ontrack never fires on the guest side.
    const audioTransceiver = newPeerConnection
      .getTransceivers()
      .find((t) => t.receiver.track.kind === 'audio');

    if (audioTransceiver) {
      await audioTransceiver.sender.replaceTrack(dummyTrack);
      audioTransceiver.direction = 'sendrecv';
      this.playerAudioSenders.set(playerId, audioTransceiver.sender);
    } else {
      // Fallback: no audio transceiver from offer (shouldn't happen with a sendrecv offer)
      console.warn(
        `[HOST] ⚠️ No audio transceiver found from offer, adding new one for ${playerId}`
      );
      const transceiver = newPeerConnection.addTransceiver(dummyTrack, { direction: 'sendrecv' });
      this.playerAudioSenders.set(playerId, transceiver.sender);
    }

    // Set up event listeners BEFORE creating answer
    this.addEventListenersToNewPeerConnection(newPeerConnection, playerId);

    const answer = await newPeerConnection.createAnswer();

    await newPeerConnection.setLocalDescription(answer);
    await waitForIceGatheringComplete(newPeerConnection);

    const sdpString = JSON.stringify(newPeerConnection.localDescription?.toJSON());

    // Store the peer connection BEFORE sending answer
    this.players.set(playerId, newPeerConnection);

    await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: sdpString, playerId })
    });
  }

  private async createDummyAudioTrack(playerId: string): Promise<MediaStreamTrack | null> {
    try {
      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();

      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();

      // Store references to prevent garbage collection
      this.dummyAudioContexts.set(playerId, { context: audioContext, oscillator, destination });

      const track = destination.stream.getAudioTracks()[0];
      return track ?? null;
    } catch (e) {
      console.error(`[HOST] ❌ Error creating dummy track:`, e);
      return null;
    }
  }

  private addEventListenersToNewPeerConnection(
    peerConnection: RTCPeerConnection,
    playerId: string
  ) {
    peerConnection.ontrack = (event) => {
      const mediaStream = event.streams[0] ?? new MediaStream([event.track]);
      this.mediaStreams.set(playerId, mediaStream);
    };

    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      peerConnection.channel = dataChannel;
      this.addEventListenersToNewPeer(dataChannel, playerId);
    };
  }

  private addEventListenersToNewPeer(dataChannel: RTCDataChannel, playerId: string) {
    dataChannel.onopen = async () => {
      this.hasDataChannel = true;

      const newAddedUserToDbRes = await fetch(`${PUBLIC_BASE_URL}/api/game/host`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roomId: this.roomId, playerId })
      });
      const newAddedUserToDb: UserClient = await newAddedUserToDbRes.json();

      gameState.room.players = [...(gameState.room.players ?? []), newAddedUserToDb];
      logPlayerJoined(newAddedUserToDb);

      // If host has already enabled their microphone, attach it to this new player
      if (this.hostMicClones.size > 0) {
        const audioSender = this.playerAudioSenders.get(playerId);
        if (audioSender) {
          const hostTrack = Array.from(this.hostMicClones.values())[0];
          if (hostTrack) {
            const clone = hostTrack.clone();
            this.hostMicClones.set(playerId, clone);
            await audioSender.replaceTrack(clone);
          }
        }
      }

      this.sendRoomStateToPlayer(playerId);
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
      this.handleRemovePlayer(playerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`[HOST] ❌ Data channel error for ${playerId}:`, error);
    };

    dataChannel.onmessage = (message) => {
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
        case 'positionUpdate':
          for (const player of gameState.room.players || []) {
            if (player.id === playerId) {
              player.position = (parsedRtcMessage as positionUpdate).position;
              break;
            }
          }
          this.broadcastToPlayers(parsedRtcMessage, { excludePlayerId: playerId });
          break;
        case 'chatMessage': {
          const chat = parsedRtcMessage as ChatMessage;
          if (chat.from === playerId) {
            const actor = gameState.room.players?.find((p) => p.id === playerId);
            logChat(actor, chat.message, chat.time);
            this.broadcastToPlayers(chat);
          }
          break;
        }
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
      }
    };
  }

  private broadcastToPlayers(msg?: RTCMessage, options?: { excludePlayerId?: string }) {
    this.players.forEach((peerConnection, playerId) => {
      if (options?.excludePlayerId && options.excludePlayerId === playerId) return;
      try {
        if (peerConnection.channel?.readyState === 'open') {
          peerConnection.channel?.send(JSON.stringify(msg));
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
      }
    } catch (e) {
      console.error(`[HOST] ❌ Error sending to player ${playerId}:`, e);
    }
  }

  private sendRoomStateToPlayer(playerId: string) {
    if (!gameState.room.players) return;

    const stateMessage: RoomStateSync = {
      event: 'roomStateSync',
      from: gameState.userId,
      players: gameState.room.players.map((p) => ({
        ...p,
        stream: undefined
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
    this.players.delete(playerId);
    this.playerAudioSenders.delete(playerId);
    this.hostMicClones.delete(playerId);
    this.dummyAudioContexts.delete(playerId);
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
    this.broadcastToPlayers({
      event: 'micToggle',
      mic,
      from: this.userId,
      time: Date.now()
    });
  }

  /**
   * Replace dummy tracks with the host's real microphone track on all guest connections.
   */
  public handleMyMediaStream(stream: MediaStream): void {
    const track = stream.getAudioTracks()[0];
    if (!track) {
      console.warn(`[HOST] ⚠️ No audio tracks found in stream!`);
      return;
    }

    this.clearMicrophoneTracks();

    this.players.forEach((peerConnection, pid) => {
      const audioSender = this.playerAudioSenders.get(pid);
      if (!audioSender) return;

      const clone = track.clone();
      this.hostMicClones.set(pid, clone);
      audioSender.replaceTrack(clone).catch((e) => {
        console.error(`[HOST] ❌ Failed to attach mic to ${pid}:`, e);
      });
    });
  }

  public override clearMicrophoneTracks(): void {
    this.hostMicClones.forEach((t) => t.stop());
    this.hostMicClones.clear();
    this.playerAudioSenders.forEach((audioSender) => {
      void audioSender.replaceTrack(null).catch((e) => {
        console.error(`[HOST] ❌ Failed to clear track:`, e);
      });
    });
  }
}

import { PUBLIC_BASE_URL } from '$env/static/public';
import type { RoomState } from '$lib/@types/user.type';
import type {
  ChatMessage,
  MeshSignalBody,
  MeshSignalInbound,
  MeshSignalOutbound,
  MicToggle,
  RoomStateChanged,
  RTCMessage
} from '$lib/@types/Rtc.type';
import { gameState, micState, type UserClient } from '$lib/store/game.svelte';
import {
  displayName,
  logChat,
  logMic,
  logPlayerJoined,
  logPlayerLeft,
  logRecolor,
  logRename
} from '$lib/store/gameEventLog.svelte';
import { get } from 'svelte/store';
import { WebRTCConnection } from './WebRTC.connection';
import { DEFAULT_RTC_CONFIGURATION, waitForIceGatheringComplete } from './webrtc-ice';

export class PlayerConnection extends WebRTCConnection {
  /** Signalling + game state (host). */
  private peerConnection: RTCPeerConnection;
  /** Full mesh between guests: direct audio to every other non-host player. */
  private readonly meshPeers = new Map<string, RTCPeerConnection>();
  private readonly meshTrackClones = new Map<string, MediaStreamTrack>();
  private currentMicTrack: MediaStreamTrack | null = null;

  constructor(playerId: string, roomId: string) {
    super('player', playerId, roomId);
    window.client = this;
    this.peerConnection = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const host = gameState.room.players?.find((p) => p.is_host);
      if (host) {
        gameState.room.players = gameState.room.players?.map((p) =>
          p.id === host.id ? { ...p, stream } : p
        );
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'failed') {
        gameState.isRoomConnecting = false;
        gameState.isPaused = true;
      }
    };

    void this.setupConnection();
  }

  /** Tell the host (and thus every peer) the current mic UI state; call after media is ready. */
  public notifyMicState(mic: boolean): void {
    if (this.peerConnection.channel?.readyState !== 'open' || !gameState.room.roomId) return;
    this.peerConnection.channel.send(
      JSON.stringify({
        event: 'micToggle',
        mic,
        from: gameState.userId,
        time: Date.now()
      } satisfies RTCMessage)
    );
  }

  private isOtherGuest(peerId: string): boolean {
    if (peerId === this.userId) return false;
    const p = gameState.room.players?.find((x) => x.id === peerId);
    return !!p && !p.is_host;
  }

  private sendMeshSignal(to: string, body: MeshSignalBody): void {
    const payload: MeshSignalOutbound = {
      event: 'meshSignal',
      to,
      body,
      time: Date.now()
    };
    this.peerConnection.channel?.send(JSON.stringify(payload));
  }

  private createMeshPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIGURATION);
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      gameState.room.players = gameState.room.players?.map((p) =>
        p.id === peerId ? { ...p, stream } : p
      );
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.closeMeshPeer(peerId);
      } else if (pc.connectionState === 'connected') {
        void this.attachMicCloneToMesh(peerId);
      }
    };
    return pc;
  }

  private attachMicCloneToMesh(peerId: string): void {
    if (!this.currentMicTrack) return;
    const pc = this.meshPeers.get(peerId);
    if (!pc || pc.connectionState !== 'connected') return;
    this.meshTrackClones.get(peerId)?.stop();
    const clone = this.currentMicTrack.clone();
    this.meshTrackClones.set(peerId, clone);
    const sender = pc
      .getSenders()
      .find((s) => s.track === null || s.track?.kind === 'audio');
    void sender?.replaceTrack(clone);
  }

  private async ensureMeshWithGuest(peerId: string): Promise<void> {
    if (!this.isOtherGuest(peerId) || this.meshPeers.has(peerId)) return;
    if (this.userId >= peerId) return;

    const pc = this.createMeshPeerConnection(peerId);
    this.meshPeers.set(peerId, pc);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      const loc = pc.localDescription?.toJSON();
      if (!loc) return;
      this.sendMeshSignal(peerId, { type: 'offer', sdp: loc });
    } catch (e) {
      console.error('Mesh offer failed', peerId, e);
      this.closeMeshPeer(peerId);
    }
  }

  private async handleIncomingMeshSignal(fromPeerId: string, body: MeshSignalBody): Promise<void> {
    if (!this.isOtherGuest(fromPeerId)) return;
    try {
      if (body.type === 'offer') {
        let pc = this.meshPeers.get(fromPeerId);
        if (!pc) {
          pc = this.createMeshPeerConnection(fromPeerId);
          this.meshPeers.set(fromPeerId, pc);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(body.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGatheringComplete(pc);
        const loc = pc.localDescription?.toJSON();
        if (loc) {
          this.sendMeshSignal(fromPeerId, { type: 'answer', sdp: loc });
        }
      } else if (body.type === 'answer') {
        const pc = this.meshPeers.get(fromPeerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(body.sdp));
        }
      }
    } catch (e) {
      console.error('Mesh signaling failed', fromPeerId, e);
      this.closeMeshPeer(fromPeerId);
    }
  }

  private closeMeshPeer(peerId: string): void {
    this.meshTrackClones.get(peerId)?.stop();
    this.meshTrackClones.delete(peerId);
    this.meshPeers.get(peerId)?.close();
    this.meshPeers.delete(peerId);
    gameState.room.players = gameState.room.players?.map((p) =>
      p.id === peerId ? { ...p, stream: undefined } : p
    );
  }

  private startMeshWithExistingGuests(): void {
    for (const p of gameState.room.players ?? []) {
      if (this.isOtherGuest(p.id) && this.userId < p.id) {
        void this.ensureMeshWithGuest(p.id);
      }
    }
  }

  private async setupConnection() {
    try {
      this.setupDataChannel('player-data');

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(this.peerConnection);
      await this.handleIceCandidate();
    } catch (e) {
      console.error('Player WebRTC setup failed', e);
      gameState.isRoomConnecting = false;
      gameState.isPaused = true;
    }
  }

  private setupDataChannel(label: string) {
    const dataChannel = this.peerConnection.createDataChannel(label);

    dataChannel.onopen = () => {
      this.hasDataChannel = true;
      gameState.isRoomConnecting = false;
      gameState.isPaused = false;
      this.notifyMicState(get(micState));
      this.startMeshWithExistingGuests();
    };
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data) as RTCMessage;
      switch (message.event) {
        case 'meshSignal': {
          const m = message as MeshSignalInbound | MeshSignalOutbound;
          if ('from' in m) {
            void this.handleIncomingMeshSignal(m.from, m.body);
          }
          break;
        }
        case 'userInfoChange': {
          const m = message as RoomStateChanged;
          const prev = new Map((gameState.room.players ?? []).map((p) => [p.id, p]));
          for (const incoming of m.room.players ?? []) {
            const old = prev.get(incoming.id);
            if (!old) continue;
            const merged: UserClient = {
              ...old,
              ...incoming,
              stream: old.stream,
              mic: old.mic,
              position: old.position
            };
            if ((old.name ?? '') !== (incoming.name ?? '')) {
              logRename(merged, displayName(old), displayName(merged));
            }
            if ((old.color ?? '').trim() !== (incoming.color ?? '').trim()) {
              logRecolor(
                merged,
                (old.color || '').trim() || '#888888',
                (incoming.color || '').trim() || '#888888'
              );
            }
          }
          gameState.room.players = (m.room.players ?? []).map((incoming) => {
            const old = prev.get(incoming.id);
            if (!old) return incoming;
            return {
              ...old,
              ...incoming,
              stream: old.stream,
              mic: old.mic,
              position: old.position
            };
          });
          if (m.room.messages) {
            gameState.room.messages = m.room.messages;
          }
          break;
        }
        case 'positionUpdate':
          gameState.room.players = gameState.room.players?.map((player) => {
            if (player.id === message.from) {
              player.position = message.position;
            }
            return player;
          });
          break;
        case 'userLeft':
          logPlayerLeft(message.user);
          gameState.room.players = gameState.room.players?.filter(
            (player) => player.id !== message.user.id
          );
          this.closeMeshPeer(message.user.id);
          break;
        case 'userJoined':
          logPlayerJoined(message.user);
          gameState.room.players = [...(gameState.room.players ?? []), message.user];
          if (this.isOtherGuest(message.user.id) && this.userId < message.user.id) {
            void this.ensureMeshWithGuest(message.user.id);
          }
          break;
        case 'micToggle': {
          const mt = message as MicToggle;
          gameState.room.players = gameState.room.players?.map((player) => {
            if (player.id !== mt.from) return player;
            const mic = mt.mic ?? false;
            return { ...player, mic, stream: mic ? player.stream : undefined };
          });
          if (mt.from !== gameState.userId) {
            const actor = gameState.room.players?.find((p) => p.id === mt.from);
            if (actor) logMic(actor, mt.mic ?? false);
          }
          break;
        }
        case 'chatMessage': {
          const c = message as ChatMessage;
          const actor = gameState.room.players?.find((p) => p.id === c.from);
          logChat(actor, c.message, c.time);
          break;
        }
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
        sdp: JSON.stringify(this.peerConnection.localDescription?.toJSON()),
        roomId: this.roomId
      })
    });
    const roomState: RoomState = await response.json();
    const hostUser = roomState.users.find((user) => user.is_host);
    if (!hostUser?.sdp) {
      throw new Error('Host user not found');
    }
    gameState.room.players = roomState.users;
    gameState.room.messages = roomState.messages;
    gameState.room.roomId = this.roomId;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(hostUser.sdp));
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
    gameState.room.players = gameState.room.players?.map((p) =>
      p.id === userId ? { ...p, ...updatedUser, stream: p.stream, position: p.position, mic: p.mic } : p
    );
    if (this.peerConnection.channel?.readyState === 'open') {
      this.peerConnection.channel.send(
        JSON.stringify({
          event: 'userInfoChange',
          user: updatedUser,
          room: gameState.room,
          from: gameState.userId,
          time: new Date().getTime()
        } satisfies RTCMessage)
      );
    }
    return updatedUser;
  }

  public handleMyMediaStream(stream: MediaStream): void {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = true;
    this.currentMicTrack = audioTrack;

    const hostSender = this.peerConnection
      .getSenders()
      .find((sender) => sender.track === null || sender.track?.kind === 'audio');
    if (hostSender) {
      void hostSender.replaceTrack(audioTrack);
    }

    this.meshPeers.forEach((_pc, peerId) => {
      void this.attachMicCloneToMesh(peerId);
    });
  }

  public override clearMicrophoneTracks(): void {
    this.currentMicTrack = null;
    this.meshTrackClones.forEach((t) => t.stop());
    this.meshTrackClones.clear();
    const hostSender = this.peerConnection
      .getSenders()
      .find((sender) => sender.track === null || sender.track?.kind === 'audio');
    void hostSender?.replaceTrack(null);
    this.meshPeers.forEach((pc) => {
      const s = pc.getSenders().find((sender) => sender.track === null || sender.track?.kind === 'audio');
      void s?.replaceTrack(null);
    });
  }
}

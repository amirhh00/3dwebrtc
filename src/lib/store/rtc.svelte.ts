// import type { SocketClient } from '$lib/store/socket.svelte';
// import type { WebRTCData } from '$lib/@types/user.type';

import { dev } from '$app/environment';
import type { RTCData } from '$lib/@types/Rtc.type';
import { gameState } from './game.svelte';

export class WebRTCConnection {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStream: MediaStream | null = null;
  private isSendingBackSdp = false;
  private _sdp: RTCSessionDescriptionInit | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  dataChannel: RTCDataChannel | null = null;

  constructor() {
    if (dev) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      window.rtc = this;
    }
  }

  async createLocalConnection() {
    return new Promise<void>((resolve) => {
      this.createIceCandidate().then(() => {
        resolve();
      });
      if (!this.peerConnection) throw new Error('Peer connection not set');
      this.dataChannel = this.peerConnection.createDataChannel('sendChannel');
      this.addListeners();
      this.peerConnection.createOffer().then((o) => this.peerConnection!.setLocalDescription(o));
    });
  }

  async joinRemoteConnection(offerSdp: RTCSessionDescriptionInit[]) {
    return new Promise<void>((resolve) => {
      this.createIceCandidate();
      if (!this.peerConnection) throw new Error('Peer connection not set');
      this.peerConnection.ondatachannel = (event) => {
        console.log('Data channel received');
        this.dataChannel = event.channel;
        this.addListeners();
      };
      this.peerConnection.setRemoteDescription(offerSdp[0]).then(() => {
        console.log('Remote description set');
      });
      this.peerConnection
        .createAnswer()
        .then((a) => this.peerConnection!.setLocalDescription(a))
        .then(() => {
          this._sdp = this.peerConnection!.localDescription;
          console.log(' NEW ice candidnat', this._sdp);
          resolve();
        });
    });
  }

  async handleNewConnection(offerSdp: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error('Peer connection not set');
    console.log('new connection', offerSdp);
    this.peerConnection.setRemoteDescription(offerSdp).then(() => {
      console.log('Remote description set');
    });
  }

  get sdp() {
    if (!this._sdp) throw new Error('SDP not set');
    return JSON.stringify(this._sdp);
  }

  private addListeners() {
    if (!this.dataChannel) throw new Error('Data channel not set');
    this.dataChannel.onopen = () => console.log('Data channel open');
    this.dataChannel.onmessage = (e) => {
      // if data is from remote user
      const data: RTCData = JSON.parse(e.data);
      // console.log('messsage received!!!' + e.data);
      if (data.type === 'position' && data.position) {
        // console.log('position received!!!');
        if (gameState.room?.players?.length && gameState.room.players.length > 1) {
          for (let i = 0; i < gameState.room.players!.length; i++) {
            const player = gameState.room.players![i];
            if (player.id === data.from) {
              player.position = data.position;
              break;
            }
          }
        }
      }
    };
    this.dataChannel.onclose = () => console.log('closed!!!!!!');
  }

  async setupLocalStream() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  private async createIceCandidate() {
    return new Promise<void>((resolve) => {
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
      this.peerConnection.onicecandidate = (e) => {
        if (!e.candidate) return;
        this._sdp = this.peerConnection!.localDescription;
        console.log(' NEW ice candidnat', this._sdp);
        resolve();
      };
    });
  }

  async sendPositionUpdate(position: { x: number; y: number; z: number }) {
    const data = JSON.stringify(position);
    this.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(data);
      }
    });
  }

  handleSendMsg(msg: string) {
    // this.dataChannels.forEach((channel) => {
    //   if (channel.readyState === 'open') {
    //     channel.send(msg);
    //   }
    // });
    if (!this.dataChannel) throw new Error('Data channel not set');
    this.dataChannel.send(msg);
  }

  closePeerConnection(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.close();
      this.peers.delete(userId);
      this.dataChannels.delete(userId);
    }
  }

  disconnect() {
    this.peers.forEach((peer, userId) => {
      peer.close();
      this.peers.delete(userId);
    });
    this.dataChannels.clear();
    this.localStream = null;
  }
}

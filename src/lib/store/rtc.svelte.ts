import { dev } from "$app/environment";
import type { RTCData } from "$lib/@types/Rtc.type";
import type { RoomState } from "$lib/@types/user.type.ts";
import { gameState } from "./game.svelte.ts";

export class WebRTCConnection {
  public dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStream: MediaStream | null = null;
  private _sdp: RTCSessionDescriptionInit | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private _offerDc: RTCDataChannel | null = null;

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
      if (!this.peerConnection) throw new Error("Peer connection not set");
      // this.dataChannel = this.peerConnection.createDataChannel('sendChannel');
      this._offerDc = this.peerConnection.createDataChannel("sendChannel");
      this.addListeners(this._offerDc);
      this.peerConnection.createOffer().then((o) =>
        this.peerConnection!.setLocalDescription(o)
      );
    });
  }

  async joinRemoteConnection(roomState: RoomState) {
    return new Promise<void>((resolve) => {
      this.createIceCandidate();
      if (!this.peerConnection) throw new Error("Peer connection not set");
      // FIX: this only works for 2 users
      const user = roomState.users[0];
      this.peerConnection.ondatachannel = (event) => {
        console.log("Data channel received");
        // userId should be the other user's id
        this.dataChannels.set(user.id, event.channel);
        this.addListeners(event.channel);
      };
      if (!user.rtcData?.sdp) {
        throw new Error("No offer sdp found");
      }
      const offerSdp = JSON.parse(user.rtcData.sdp);
      this.peerConnection.setRemoteDescription(offerSdp).then(() => {
        console.log("Remote description set");
      });
      this.peerConnection
        .createAnswer()
        .then((a) => this.peerConnection!.setLocalDescription(a))
        .then(() => {
          this._sdp = this.peerConnection!.localDescription;
          console.log(" NEW ice candidnat", this._sdp);
          resolve();
        });
    });
  }

  async handleNewConnection(
    offerSdp: RTCSessionDescriptionInit,
    userId: string,
  ) {
    if (!this.peerConnection || !this._offerDc) {
      throw new Error("Peer connection not set");
    }
    // add new remote description
    if (this.peerConnection.signalingState !== "stable") {
      await this.peerConnection.setRemoteDescription(offerSdp);
      this.dataChannels.set(userId, this._offerDc);
      console.log("Remote description set", offerSdp);
    } else {
      console.error(this.peerConnection);
      throw new Error("Signaling state is stable");
    }
  }

  get sdp() {
    if (!this._sdp) throw new Error("SDP not set");
    return JSON.stringify(this._sdp);
  }

  private addListeners(dc: RTCDataChannel) {
    if (!dc) throw new Error("Data channel not set");
    dc.onopen = () => console.log("Data channel open");
    dc.onclose = () => console.log("closed!!!!!!");
    dc.onmessage = (e) => {
      try {
        // if data is from remote user
        const data: RTCData = JSON.parse(e.data);
        if (data.type === "position" && data.position) {
          if (
            gameState.room?.players?.length && gameState.room.players.length > 1
          ) {
            for (let i = 0; i < gameState.room.players!.length; i++) {
              const player = gameState.room.players![i];
              if (player.id === data.from) {
                player.position = data.position;
                break;
              }
            }
          }
        }
      } catch {
        // new message received from remote user
        console.log(e.data);
      }
    };
  }

  async setupLocalStream() {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
  }

  private async createIceCandidate() {
    return new Promise<void>((resolve) => {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
              // More STUN/TURN servers here if needed
            ],
          },
        ],
      });
      this.peerConnection.onicecandidate = (e) => {
        if (!e.candidate) return;
        this._sdp = this.peerConnection!.localDescription;
        console.log(" NEW ice candidnat", this._sdp);
        resolve();
      };
    });
  }

  public sendPositionUpdate(position: { x: number; y: number; z: number }) {
    try {
      if (
        this.dataChannels &&
        this.dataChannels.size > 0
      ) {
        // if (this._offerDc) {
        //   debugger;
        // }
        for (const dc of this.dataChannels.values()) {
          if (dc.readyState === "open") {
            const data = {
              type: "position",
              position,
              from: gameState.userId,
            };
            dc.send(JSON.stringify(data));
          }
        }
      }
    } catch (error) {
      console.error("Error sending position update", error);
    }
  }

  sendMessage(msg: string, userId?: string) {
    if (!userId) {
      for (const dc of this.dataChannels.values()) {
        dc.send(msg);
      }
    } else {
      this.dataChannels.get(userId)?.send(msg);
    }
  }

  closePeerConnection(userId: string) {
    const dc = this.dataChannels.get(userId);
    if (!dc) return;

    dc.close();
    this.dataChannels.delete(userId);

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null; // Reset the peer connection
    }
  }
}

import { PUBLIC_BASE_URL } from '$env/static/public';
import { type UserClient } from '$lib/store/game.svelte';

export abstract class WebRTCConnection {
  private readonly MAX_PLAYERS = 10;
  protected role: 'host' | 'player';
  protected userId: string;
  protected roomId: string;
  public hasDataChannel = false;
  public mediaStream: MediaStream | null = null;

  constructor(role: 'host' | 'player', userId: string, roomId: string) {
    this.role = role;
    this.userId = userId;
    this.roomId = roomId;
    // micState.subscribe((value) => {
    //   this.handleMicToggle(value);
    // });
  }

  /**
   * send a position update to the other peer(s)
   * @param x The x coordinate of the user
   * @param y The y coordinate of the user
   * @param z The z coordinate of the user
   */
  public abstract sendPositionUpdate(x: number, y: number, z: number): void;

  /**
   * Send a message to the other peer
   * @param message The message to send to the other peer
   */
  public abstract sendMessage(message: string): void;

  public abstract handleMyMediaStream(stream: MediaStream): void;

  /**
   * Update the user info in the database and send the updated user info to the other peer(s)
   * @param name The updated name of the user
   * @param color The updated color of the user
   * @param userId The user ID of the user
   */
  public async updateUserInfoChange(name: string, color: string, userId: string) {
    return WebRTCConnection.sendUserInfoChange(name, color, userId);
  }

  /**
   * Update the user info in the database if the user has not connected to a room yet
   */
  public static async sendUserInfoChange(name: string, color: string, userId: string) {
    const updatedUserRes = await fetch(`${PUBLIC_BASE_URL}/api/user`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, userId }),
      credentials: 'include'
    });
    const updatedUser: UserClient = await updatedUserRes.json();
    return updatedUser;
  }
  /**
   * handle mic mute/unmute
   */
  // private async handleMicToggle(mic: boolean, userId?: string) {
  //   return WebRTCConnection.handleMicToggle(mic, userId || this.userId);
  // }
  /**
   * handle mic mute/unmute if the user has not connected to a room yet
   */
  // public static async handleMicToggle(mic: boolean, userId: string) {

  // }
}

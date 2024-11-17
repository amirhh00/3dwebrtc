import { PUBLIC_BASE_URL } from '$env/static/public';
import type { UserClient } from '$lib/store/game.svelte';

export abstract class WebRTCConnection {
  protected role: 'host' | 'player';
  protected userId: string;
  protected roomId: string;
  public hasDataChannel = false;

  constructor(role: 'host' | 'player', userId: string, roomId: string) {
    this.role = role;
    this.userId = userId;
    this.roomId = roomId;
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

  /**
   * Update the user info in the database and send the updated user info to the other peer(s)
   * @param name The updated name of the user
   * @param color The updated color of the user
   * @param userId The user ID of the user
   */
  public async updateUserInfoChange(name: string, color: string, userId: string) {
    return WebRTCConnection.sendUserInfoChange(name, color, userId);
  }

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
}

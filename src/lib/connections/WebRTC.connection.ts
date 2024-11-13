export abstract class WebRTCConnection {
  protected role: 'host' | 'player';
  protected userId: string;
  protected roomId: string;

  constructor(role: 'host' | 'player', userId: string, roomId: string) {
    this.role = role;
    this.userId = userId;
    this.roomId = roomId;
  }

  protected handleDataChannelMessage(data: string) {
    console.log(`${this.role} received data:`, data);
    // Process incoming data as needed
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
   * Update the user info for the other peer
   * @param name The updated name of the user
   * @param color The updated color of the user
   * @param userId The user ID of the user
   */
  public abstract updateUserInfoChange(name: string, color: string, userId: string): void;
}

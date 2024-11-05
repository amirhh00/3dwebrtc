// src/lib/notify.ts
import pool from '$lib/db';

/**
 * Notify all clients in a room that the room has been updated
 * @param roomId  The room id
 * @param data  The data to send to the room
 * @example 
 * await notifyRoomUpdate('room123', { event: 'userJoined', userId: 'user456' });
 */
export async function notifyRoomUpdate(roomId: string, data: unknown) {
  const payload = JSON.stringify(data);
  const channel = `room_${roomId}`;

  const client = await pool.connect();
  await client.query(`NOTIFY ${channel}, '${payload}'`);
  client.release();
}
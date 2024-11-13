import { sql } from 'drizzle-orm';
import { db } from '../db/db';
import type { messages, users } from '../db/schema';

export async function getCurrentRoomState(
  roomId: string,
  options?: { newUser?: { id: string; sdp: string } }
) {
  type RoomState = {
    users: (typeof users.$inferSelect)[];
    messages: (typeof messages.$inferSelect)[];
    newUser?: typeof users.$inferSelect;
  };
  const roomState = await db.execute<RoomState>(sql`
  SELECT
    r.*,
    (
      SELECT json_agg(u.*)
      FROM users u
      WHERE u.room_id = r.id
    ) AS users,
    (
      SELECT json_agg(m.*)
      FROM messages m
      WHERE m.room_id = r.id
    ) AS messages
  FROM rooms r
  WHERE r.id = ${roomId};
`);
  return options?.newUser
    ? {
        ...roomState.rows[0],
        newUser: {
          ...roomState.rows[0].users.find((u) => u.id === options?.newUser?.id),
          sdp: options.newUser.sdp,
          id: options.newUser.id
        }
      }
    : roomState.rows[0];
}

export function hashUUIDtoSimpleInteger(uuid: string): number {
  return uuid
    .split('-')
    .map((part) => parseInt(part, 16))
    .reduce((acc, curr) => acc + curr, 0);
}

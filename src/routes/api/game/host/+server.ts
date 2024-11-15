import type { RequestHandler } from '@sveltejs/kit';
import { db, pool } from '$lib/server/db/db';
import { eq, sql } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
// import { SdpEventHandler } from '$lib/server/sdp.event';
import { getCurrentRoomState, hashUUIDtoSimpleInteger } from '$lib/server/helper/db.functions';
import type { Notification } from 'pg';

/**
 * @description create a new room using server sent events (SSE) and return the roomId while listening for the room's changes (notifiacations)
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    cookies.set('userId', '', { expires: new Date(0), path: '/' });
    return new Response('Unauthorized', { status: 401 });
  }

  const user = (await db.select().from(users).where(eq(users.id, userId)))[0];

  if (!user) return new Response('Unauthorized', { status: 401 });

  if (user.is_host) {
    // remove the user from the room if it is already a host and delete the room
    await db.execute(sql`
      WITH updated_host AS (
        UPDATE users
        SET is_host = false
        WHERE id=${userId}
      ),
      deleted_room AS (
        DELETE FROM rooms
        WHERE id=${user.roomId}
      )
      SELECT 1;
    `);
  }

  const result = await db.execute(sql`
  WITH new_room AS (
    INSERT INTO rooms DEFAULT VALUES
    RETURNING *
  )
  UPDATE users
  SET room_id = new_room.id, is_host = true
  FROM new_room
  WHERE users.id = ${userId}
  RETURNING new_room.*;
`);

  const room = result.rows[0] as { id: string };
  let isRoomSent = false;
  // const sdpEventHandler = new SdpEventHandler();
  const roomChannel = `room_${hashUUIDtoSimpleInteger(room.id)}`;
  const client = await pool.connect();
  await client.query(`LISTEN ${roomChannel}`);
  const stream = new ReadableStream({
    async start(controller) {
      const notificationHandler = async (msg: Notification) => {
        if (msg.channel === roomChannel) {
          controller.enqueue(`event: newUser\n`);
          const newUser = JSON.parse(msg.payload!);
          controller.enqueue(
            `data: ${JSON.stringify(await getCurrentRoomState(room.id, { newUser }))}\n\n`
          );
        }
      };
      // sdpEventHandler.on(`room-${hashUUIDtoSimpleInteger(room.id)}`, async (newUser) => {
      //   controller.enqueue(`event: newUser\n`);
      //   controller.enqueue(
      //     `data: ${JSON.stringify(await getCurrentRoomState(room.id, { newUser }))}\n\n`
      //   );
      // });
      client.on('notification', notificationHandler);
      if (!isRoomSent) {
        controller.enqueue(`data: ${JSON.stringify(await getCurrentRoomState(room.id))}\n\n`);
        isRoomSent = true;
      }
    },
    cancel() {
      // sdpEventHandler.removeAllListeners(`room-${hashUUIDtoSimpleInteger(room.id)}`);
      client.removeAllListeners('notification');
      client.query(`UNLISTEN ${roomChannel}`).catch(console.error);
      client.release();
      dbCleanup(userId, room.id);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Content-Encoding': 'none',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    }
  });
};

/**
 * @description send answer sdp to the player from host
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { sdp, playerId } = await request.json();
  if (!sdp) {
    return new Response('Bad Request', { status: 400 });
  }

  // const sdpEventHandler = new SdpEventHandler();
  const client = await pool.connect();
  const playerChannel = `sdp_${hashUUIDtoSimpleInteger(playerId)}`;
  // sdpEventHandler.emit(`sdp-${hashUUIDtoSimpleInteger(playerId)}`, sdp);
  client.query(`NOTIFY ${playerChannel}, '${sdp}'`);

  return new Response('Answer sent to player', {
    headers: { 'Content-Type': 'application/json' }
  });
};

/**
 * @description add player to the room in the database
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { roomId, playerId } = await request.json();
  if (!roomId || !playerId) {
    return new Response('Bad Request', { status: 400 });
  }

  // update the host's room_id and add the player to the room only and if only userId belongs to a host in its room
  const verfiedHost = await db.execute(sql`
    SELECT 1 FROM users WHERE id=${userId} AND is_host=true AND room_id=${roomId};
  `);
  if (verfiedHost.rowCount === 0) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await db.execute(sql`
    UPDATE users
    SET room_id=${roomId}
    WHERE id=${playerId} AND room_id IS NULL
    RETURNING *;
  `);

  return new Response(JSON.stringify(result.rows[0]), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { roomId, playerId } = await request.json();
  if (!roomId || !playerId) {
    return new Response('Bad Request', { status: 400 });
  }

  // update the host's room_id and add the player to the room only and if only userId belongs to a host in its room
  const verfiedHost = await db.execute(sql`
    SELECT 1 FROM users WHERE id=${userId} AND is_host=true AND room_id=${roomId};
  `);
  if (verfiedHost.rowCount === 0) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await db.execute(sql`
    UPDATE users
    SET room_id=NULL
    WHERE id=${playerId} AND room_id=${roomId}
    RETURNING *;
  `);

  return new Response(JSON.stringify(result.rows[0]), {
    headers: { 'Content-Type': 'application/json' }
  });
};

async function dbCleanup(userId: string, roomId: string) {
  await db.execute(sql`
            WITH updated_host AS (
              UPDATE users
              SET is_host = false
              WHERE id=${userId} OR room_id=${roomId}
            ),
            deleted_room AS (
              DELETE FROM rooms
              WHERE id=${roomId}
            )
            SELECT 1;
          `);
}

import type { RequestHandler } from '@sveltejs/kit';
import { db, pool } from '$lib/server/db/db';
import { sql } from 'drizzle-orm';
// import { SdpEventHandler } from '$lib/server/sdp.event';
import { getCurrentRoomState, hashUUIDtoSimpleInteger } from '$lib/server/helper/db.functions';
import type { Notification } from 'pg';

/**
 * @description Get the list of rooms
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { rows } = await db.execute(
    sql`SELECT rooms.id AS "roomId",
      MAX(CASE WHEN users.is_host THEN users.name END) AS "roomName",
      COUNT(users.id) AS "playersCount"
    FROM rooms
    INNER JOIN users ON users.room_id = rooms.id
    GROUP BY rooms.id;`
  );

  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json' }
  });
};

/**
 * @description join a room by roomId
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const userId = cookies.get('userId');
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { roomId, sdp } = await request.json();
  if (!roomId || !sdp) {
    return new Response('Bad Request', { status: 400 });
  }

  const answerSdp = await waitForAnswerSdp(userId, roomId, sdp);
  const roomState = await getCurrentRoomState(roomId);
  roomState.users = roomState.users.map((user) => {
    if (user.is_host) {
      // @ts-expect-error sdp is not defined in user yet
      user.sdp = answerSdp;
    }
    return user;
  });
  return new Response(JSON.stringify(roomState), {
    headers: { 'Content-Type': 'application/json' }
  });
};

async function waitForAnswerSdp(userId: string, roomId: string, sdp: string) {
  const client = await pool.connect();
  return new Promise<string>((resolve) => {
    // const sdpEventHandler = new SdpEventHandler();
    // sdpEventHandler.emit(`room-${hashUUIDtoSimpleInteger(roomId)}`, { id: userId, sdp });
    client.query(
      `NOTIFY room_${hashUUIDtoSimpleInteger(roomId)}, '${JSON.stringify({ id: userId, sdp })}'`
    );
    // sdpEventHandler.on(`sdp-${hashUUIDtoSimpleInteger(userId)}`, (data) => {
    //   resolve(data);
    // });
    const playerChannel = `sdp_${hashUUIDtoSimpleInteger(userId)}`;
    client.query(`LISTEN ${playerChannel}`);
    const handleNotification = (msg: Notification) => {
      if (msg.channel === playerChannel) {
        const data = JSON.parse(msg.payload!);
        client.removeListener('notification', handleNotification);
        client.query(`UNLISTEN ${playerChannel}`);
        client.release();
        resolve(data);
      }
    };
    client.on('notification', handleNotification);
  });
}

// await db.execute(`NOTIFY room_${hashUUIDtoSimpleInteger(roomId)}, '${JSON.stringify(tempUser)}'`);

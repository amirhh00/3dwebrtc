// src/routes/api/game/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import pool from '$lib/db';

export const GET: RequestHandler = async ({ request, url }) => {
  const roomId = url.searchParams.get('roomId');
  if (!roomId) {
    return new Response('Room ID is required', { status: 400 });
  }

  const channel = `room_${roomId}`;

  const client = await pool.connect();
  await client.query(`LISTEN ${channel}`);

  const stream = new ReadableStream({
    start(controller) {
      const notificationHandler = (msg: { channel: string; payload: unknown; }) => {
        if (msg.channel === channel) {
          controller.enqueue(`data: ${msg.payload}\n\n`);
        }
      };

      client.on('notification', notificationHandler);

      request.signal.addEventListener('abort', async () => {
        controller.close();
        client.removeListener('notification', notificationHandler);
        await client.query(`UNLISTEN ${channel}`).catch(console.error);
        client.release();
      });
    },
    cancel() {
      // Clean up if the stream is cancelled
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
    },
  });
};
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * @description users can update their name and color using this endpoint
 * @param {string} name - the new name of the user
 * @param {string} color - the new color of the user
 * @param {string} userId - the id of the user to update provided by the host in the same room
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const cookieUserId = cookies.get('userId');
  if (!cookieUserId) {
    cookies.set('userId', '', { expires: new Date(0), path: '/' });
    return new Response('Unauthorized', { status: 401 });
  }

  const { name, color, userId } = await request.json();

  if (!name && !color) {
    return new Response('No data to update', { status: 400 });
  }

  if (userId && userId !== cookieUserId) {
    // check if user is a host and the userId is in the same room as the cookieUserId
    const hasAccess = await db.execute(
      sql`SELECT * FROM users WHERE id = ${cookieUserId} AND is_host = true AND room_id = (SELECT room_id FROM users WHERE id = ${userId})`
    );
    if (hasAccess.rows.length === 0) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  if (name && color) {
    await db
      .update(users)
      .set({ name, color })
      .where(eq(users.id, userId || cookieUserId));
  } else if (name) {
    await db
      .update(users)
      .set({ name })
      .where(eq(users.id, userId || cookieUserId));
  } else if (color) {
    await db
      .update(users)
      .set({ color })
      .where(eq(users.id, userId || cookieUserId));
  }

  return new Response(`User ${userId || cookieUserId} updated successfully`, { status: 200 });
};

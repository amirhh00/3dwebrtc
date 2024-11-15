import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * @description users can update their name and color using this endpoint
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
  const cookieUserId = cookies.get('userId');
  if (!cookieUserId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { name, color } = await request.json();

  if (!name && !color) {
    return new Response('No data to update', { status: 400 });
  }

  // if (userId && userId !== cookieUserId) {
  //   // check if user is a host and the userId is in the same room as the cookieUserId
  //   const hasAccess = await db.execute(
  //     sql`SELECT * FROM users WHERE id = ${cookieUserId} AND is_host = true AND room_id = (SELECT room_id FROM users WHERE id = ${userId})`
  //   );
  //   if (hasAccess.rows.length === 0) {
  //     return new Response('Unauthorized', { status: 401 });
  //   }
  // }
  let updatedUser: (typeof users.$inferSelect)[] | null = null;
  if (name && color) {
    updatedUser = await db
      .update(users)
      .set({ name, color })
      .where(eq(users.id, cookieUserId))
      .returning();
  } else if (name) {
    updatedUser = await db
      .update(users)
      .set({ name })
      .where(eq(users.id, cookieUserId))
      .returning();
  } else if (color) {
    updatedUser = await db
      .update(users)
      .set({ color })
      .where(eq(users.id, cookieUserId))
      .returning();
  }

  if (!updatedUser) return new Response('No data to update', { status: 400 });

  return new Response(JSON.stringify(updatedUser[0]), { status: 200 });
};

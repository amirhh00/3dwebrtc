import { db } from '$lib/server/db/db.js';
import { sql } from 'drizzle-orm';
import type { users } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';

export async function load({ cookies, request }) {
  if (request.method !== 'GET') return {};
  const userId = cookies.get('userId');
  type UserFromDb = typeof users.$inferSelect;
  let user: UserFromDb | null = null;

  if (!userId) {
    user = (
      await db.execute<UserFromDb>(sql`
      INSERT INTO users (name, color) VALUES ('Guest', '#000000')
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `)
    ).rows[0];
    cookies.set('userId', user.id, {
      path: '/',
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 400)
    });
  } else {
    // get user from db
    const { rows: userFromDb } = await db.execute<UserFromDb>(
      sql`SELECT id, name, color FROM users WHERE id=${userId}`
    );
    user = userFromDb[0];
    if (!user) {
      console.error('User not found in db');
      // reload page to create a new user
      cookies.set('userId', '', { expires: new Date(0), path: '/' });
      throw redirect(302, '/');
    }
  }

  return {
    user
  };
}

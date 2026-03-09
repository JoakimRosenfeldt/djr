import type { Doc } from '../_generated/dataModel';
import type { DatabaseReader, DatabaseWriter } from '../_generated/server';
import { hashString } from './helpers';

type Db = DatabaseReader | DatabaseWriter;

export async function getRoomBySlug(db: Db, slug: string) {
	return db
		.query('rooms')
		.withIndex('by_slug', (query) => query.eq('slug', slug))
		.unique();
}

export async function requireRoomBySlug(db: Db, slug: string) {
	const room = await getRoomBySlug(db, slug);
	if (!room) {
		throw new Error('Room not found.');
	}

	return room;
}

export async function getAdminSessionByToken(db: Db, rawToken: string) {
	const sessionTokenHash = await hashString(rawToken);

	return db
		.query('adminSessions')
		.withIndex('by_tokenHash', (query) => query.eq('sessionTokenHash', sessionTokenHash))
		.unique();
}

export async function requireAdminSession(db: Db, roomId: Doc<'rooms'>['_id'], rawToken: string) {
	const session = await getAdminSessionByToken(db, rawToken);

	if (!session || session.roomId !== roomId || session.expiresAt <= Date.now()) {
		throw new Error('DJ access has expired. Use your PIN to sign back in.');
	}

	return session;
}

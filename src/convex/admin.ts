import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { ADMIN_SESSION_TTL_MS } from './lib/constants';
import { getAdminSessionByToken, requireRoomBySlug } from './lib/auth';
import { createToken, hashString } from './lib/helpers';

export const exchangeLinkToken = mutation({
	args: {
		slug: v.string(),
		token: v.string()
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.slug);
		const tokenHash = await hashString(args.token);
		const linkToken = await ctx.db
			.query('adminLinkTokens')
			.withIndex('by_tokenHash', (query) => query.eq('tokenHash', tokenHash))
			.unique();

		if (!linkToken || linkToken.roomId !== room._id) {
			throw new Error('This admin link is invalid.');
		}

		if (linkToken.usedAt) {
			throw new Error('This admin link has already been used.');
		}

		if (linkToken.expiresAt <= Date.now()) {
			throw new Error('This admin link has expired.');
		}

		const sessionToken = createToken();
		const sessionTokenHash = await hashString(sessionToken);
		const createdAt = Date.now();

		await ctx.db.patch(linkToken._id, {
			usedAt: createdAt
		});

		await ctx.db.insert('adminSessions', {
			roomId: room._id,
			sessionTokenHash,
			expiresAt: createdAt + ADMIN_SESSION_TTL_MS,
			createdAt,
			lastSeenAt: createdAt
		});

		return {
			sessionToken,
			expiresAt: createdAt + ADMIN_SESSION_TTL_MS
		};
	}
});

export const loginWithPin = mutation({
	args: {
		slug: v.string(),
		pin: v.string()
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.slug);
		const pinHash = await hashString(args.pin.trim());

		if (pinHash !== room.pinHash) {
			throw new Error('That PIN is not valid for this room.');
		}

		const sessionToken = createToken();
		const sessionTokenHash = await hashString(sessionToken);
		const createdAt = Date.now();

		await ctx.db.insert('adminSessions', {
			roomId: room._id,
			sessionTokenHash,
			expiresAt: createdAt + ADMIN_SESSION_TTL_MS,
			createdAt,
			lastSeenAt: createdAt
		});

		return {
			sessionToken,
			expiresAt: createdAt + ADMIN_SESSION_TTL_MS
		};
	}
});

export const logout = mutation({
	args: {
		adminSessionToken: v.string()
	},
	handler: async (ctx, args) => {
		const session = await getAdminSessionByToken(ctx.db, args.adminSessionToken);

		if (session) {
			await ctx.db.delete(session._id);
		}

		return { success: true };
	}
});

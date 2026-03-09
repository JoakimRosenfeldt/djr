import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ADMIN_LINK_TOKEN_TTL_MS } from './lib/constants';
import { getRoomBySlug, requireAdminSession, requireRoomBySlug } from './lib/auth';
import { createPin, createToken, hashString, slugify, trimOrigin } from './lib/helpers';
import {
	getViewerVotes,
	listRequestsByStatus,
	sortActiveRequests,
	toAdminRequest,
	toPublicRequest
} from './lib/requests';

export const createRoom = mutation({
	args: {
		djName: v.string(),
		eventName: v.string(),
		origin: v.string()
	},
	handler: async (ctx, args) => {
		const baseSlug = slugify(`${args.djName}-${args.eventName}`) || 'room';
		let slug = baseSlug;

		while (await getRoomBySlug(ctx.db, slug)) {
			slug = `${baseSlug}-${createToken(2)}`;
		}

		const pin = createPin();
		const pinHash = await hashString(pin);
		const createdAt = Date.now();
		const roomId = await ctx.db.insert('rooms', {
			slug,
			eventName: args.eventName.trim(),
			djName: args.djName.trim(),
			status: 'active',
			createdAt,
			pinHash
		});

		const adminLinkToken = createToken();
		const tokenHash = await hashString(adminLinkToken);

		await ctx.db.insert('adminLinkTokens', {
			roomId,
			tokenHash,
			expiresAt: createdAt + ADMIN_LINK_TOKEN_TTL_MS
		});

		const origin = trimOrigin(args.origin);

		return {
			roomSlug: slug,
			pin,
			guestUrl: `${origin}/r/${slug}`,
			adminUrl: `${origin}/dj/${slug}?token=${adminLinkToken}`
		};
	}
});

export const getPublicRoom = query({
	args: {
		slug: v.string(),
		guestId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.slug);
		const activeRequests = sortActiveRequests(
			await listRequestsByStatus(ctx.db, room._id, 'active')
		);
		const playedRequests = await listRequestsByStatus(ctx.db, room._id, 'played');
		const viewerVotes = await getViewerVotes(ctx.db, room._id, args.guestId);

		return {
			room: {
				id: room._id,
				slug: room.slug,
				eventName: room.eventName,
				djName: room.djName,
				status: room.status
			},
			activeRequests: activeRequests.map((request) =>
				toPublicRequest(request, viewerVotes.get(request._id))
			),
			playedRequests: [...playedRequests]
				.sort((left, right) => (right.playedAt ?? 0) - (left.playedAt ?? 0))
				.map((request) => toPublicRequest(request, viewerVotes.get(request._id)))
		};
	}
});

export const getAdminRoom = query({
	args: {
		slug: v.string(),
		adminSessionToken: v.string()
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.slug);
		await requireAdminSession(ctx.db, room._id, args.adminSessionToken);

		const activeRequests = sortActiveRequests(
			await listRequestsByStatus(ctx.db, room._id, 'active')
		);
		const playedRequests = await listRequestsByStatus(ctx.db, room._id, 'played');

		return {
			room: {
				id: room._id,
				slug: room.slug,
				eventName: room.eventName,
				djName: room.djName,
				status: room.status
			},
			activeRequests: activeRequests.map(toAdminRequest),
			playedRequests: [...playedRequests]
				.sort((left, right) => (right.playedAt ?? 0) - (left.playedAt ?? 0))
				.map(toAdminRequest)
		};
	}
});

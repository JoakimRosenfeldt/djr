import { v } from 'convex/values';
import { DEFAULT_ROOM_COLOR } from '../lib/room-colors';
import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';
import { ADMIN_LINK_TOKEN_TTL_MS } from './lib/constants';
import { getRoomBySlug, requireAdminSession, requireRoomBySlug } from './lib/auth';
import { createPin, createToken, hashString, slugify, trimOrigin } from './lib/helpers';
import {
	providerCredentialsValidator,
	providerValidator,
	roomColorValidator
} from './lib/validators';
import {
	getViewerVotes,
	listRequestsByStatus,
	sortActiveRequests,
	toAdminRequest,
	toPublicRequest
} from './lib/requests';

const DEFAULT_ENABLED_PROVIDERS = ['soundcloud', 'spotify'] as const;

async function deleteRequestAndVotes(ctx: MutationCtx, requestId: Id<'requests'>) {
	const votes = await ctx.db
		.query('votes')
		.withIndex('by_requestId_guestId', (query) => query.eq('requestId', requestId))
		.collect();

	for (const vote of votes) {
		await ctx.db.delete(vote._id);
	}

	await ctx.db.delete(requestId);
}

async function deleteRoomProviderRecords(
	ctx: MutationCtx,
	roomId: Id<'rooms'>,
	providers?: Array<'soundcloud' | 'spotify'>
) {
	const enabledProviders = getRoomEnabledProviders(providers);

	for (const provider of enabledProviders) {
		const tokenRecord = await ctx.db
			.query('providerTokens')
			.withIndex('by_roomId_provider', (query) => query.eq('roomId', roomId).eq('provider', provider))
			.unique();

		if (tokenRecord) {
			await ctx.db.delete(tokenRecord._id);
		}

		const searchCacheEntries = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_roomId_provider_normalizedQuery', (query) =>
				query.eq('roomId', roomId).eq('provider', provider)
			)
			.collect();

		for (const entry of searchCacheEntries) {
			await ctx.db.delete(entry._id);
		}
	}
}

function normalizeProviderCredentials(
	credentials?: { clientId: string; clientSecret: string } | null
) {
	const clientId = credentials?.clientId?.trim();
	const clientSecret = credentials?.clientSecret?.trim();

	if (!clientId || !clientSecret) {
		return null;
	}

	return {
		clientId,
		clientSecret
	};
}

function resolveSelectedProviders(providers: Array<'soundcloud' | 'spotify'>) {
	return DEFAULT_ENABLED_PROVIDERS.filter((provider) => providers.includes(provider));
}

function getRoomEnabledProviders(providers?: Array<'soundcloud' | 'spotify'>) {
	const uniqueProviders = resolveSelectedProviders(providers ?? []);

	if (uniqueProviders.length === 0) {
		return [...DEFAULT_ENABLED_PROVIDERS];
	}

	return uniqueProviders;
}

export const createRoom = mutation({
	args: {
		djName: v.string(),
		eventName: v.string(),
		color: v.optional(roomColorValidator),
		enabledProviders: v.array(providerValidator),
		soundcloudCredentials: v.optional(providerCredentialsValidator),
		spotifyCredentials: v.optional(providerCredentialsValidator),
		origin: v.string()
	},
	handler: async (ctx, args) => {
		const enabledProviders = resolveSelectedProviders(args.enabledProviders);
		const soundcloudCredentials = normalizeProviderCredentials(args.soundcloudCredentials);
		const spotifyCredentials = normalizeProviderCredentials(args.spotifyCredentials);

		if (enabledProviders.length === 0) {
			throw new Error('Choose at least one music provider.');
		}

		if (enabledProviders.includes('soundcloud') && !soundcloudCredentials) {
			throw new Error('Add a SoundCloud client ID and secret.');
		}

		if (enabledProviders.includes('spotify') && !spotifyCredentials) {
			throw new Error('Add a Spotify client ID and secret.');
		}

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
			color: args.color ?? DEFAULT_ROOM_COLOR,
			enabledProviders,
			soundcloudCredentials: soundcloudCredentials ?? undefined,
			spotifyCredentials: spotifyCredentials ?? undefined,
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
				color: room.color ?? DEFAULT_ROOM_COLOR,
				enabledProviders: getRoomEnabledProviders(room.enabledProviders),
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
				color: room.color ?? DEFAULT_ROOM_COLOR,
				enabledProviders: getRoomEnabledProviders(room.enabledProviders),
				status: room.status
			},
			activeRequests: activeRequests.map(toAdminRequest),
			playedRequests: [...playedRequests]
				.sort((left, right) => (right.playedAt ?? 0) - (left.playedAt ?? 0))
				.map(toAdminRequest)
		};
	}
});

export const closeRoom = mutation({
	args: {
		roomSlug: v.string(),
		adminSessionToken: v.string()
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.roomSlug);
		await requireAdminSession(ctx.db, room._id, args.adminSessionToken);

		const closedAt = room.closedAt ?? Date.now();
		const [activeRequests, playedRequests, sessions, adminLinkTokens] = await Promise.all([
			ctx.db
				.query('requests')
				.withIndex('by_roomId_status', (query) =>
					query.eq('roomId', room._id).eq('status', 'active')
				)
				.collect(),
			ctx.db
				.query('requests')
				.withIndex('by_roomId_status', (query) =>
					query.eq('roomId', room._id).eq('status', 'played')
				)
				.collect(),
			ctx.db
				.query('adminSessions')
				.withIndex('by_roomId', (query) => query.eq('roomId', room._id))
				.collect(),
			ctx.db
				.query('adminLinkTokens')
				.withIndex('by_roomId', (query) => query.eq('roomId', room._id))
				.collect()
		]);

		if (room.status !== 'closed') {
			await ctx.db.patch(room._id, {
				status: 'closed',
				closedAt
			});
		}

		for (const request of [...activeRequests, ...playedRequests]) {
			await deleteRequestAndVotes(ctx, request._id);
		}

		await deleteRoomProviderRecords(ctx, room._id, room.enabledProviders);

		for (const session of sessions) {
			await ctx.db.delete(session._id);
		}

		for (const token of adminLinkTokens) {
			await ctx.db.delete(token._id);
		}

		return {
			success: true,
			closedAt
		};
	}
});

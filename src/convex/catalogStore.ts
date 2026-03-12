import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { requireRoomBySlug } from './lib/auth';
import { PROVIDER_SEARCH_CACHE_TTL_MS } from './lib/constants';
import {
	cachedSearchResultValidator,
	nullableStringValidator,
	providerValidator
} from './lib/validators';

export const getRoomTrackStates = internalQuery({
	args: {
		roomSlug: v.string()
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.roomSlug);

		if (room.status === 'closed') {
			throw new Error('This room has been closed.');
		}

		const enabledProviders =
			room.enabledProviders && room.enabledProviders.length > 0
				? (['soundcloud', 'spotify'] as const).filter((provider) =>
						room.enabledProviders?.includes(provider)
					)
				: ['soundcloud', 'spotify'];
		const requests = await ctx.db
			.query('requests')
			.withIndex('by_roomId_status', (query) => query.eq('roomId', room._id).eq('status', 'active'))
			.collect();
		const played = await ctx.db
			.query('requests')
			.withIndex('by_roomId_status', (query) => query.eq('roomId', room._id).eq('status', 'played'))
			.collect();

		return {
			roomId: room._id,
			enabledProviders,
			soundcloudCredentials: room.soundcloudCredentials ?? null,
			spotifyCredentials: room.spotifyCredentials ?? null,
			activeTrackKeys: requests.map((request) => request.sourceTrackKey),
			playedTrackKeys: played.map((request) => request.sourceTrackKey)
		};
	}
});

export const getCachedSearch = internalQuery({
	args: {
		roomId: v.id('rooms'),
		provider: providerValidator,
		normalizedQuery: v.string()
	},
	handler: async (ctx, args) => {
		const cached = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_roomId_provider_normalizedQuery', (query) =>
				query
					.eq('roomId', args.roomId)
					.eq('provider', args.provider)
					.eq('normalizedQuery', args.normalizedQuery)
			)
			.unique();

		if (!cached || cached.expiresAt <= Date.now()) {
			return null;
		}

		return cached;
	}
});

export const cleanupExpiredSearchCaches = internalMutation({
	args: {},
	handler: async (ctx) => {
		const expiredEntries = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_expiresAt', (query) => query.lte('expiresAt', Date.now()))
			.collect();

		for (const entry of expiredEntries) {
			await ctx.db.delete(entry._id);
		}

		return {
			deletedCount: expiredEntries.length
		};
	}
});

export const cleanupExpiredProviderTokens = internalMutation({
	args: {},
	handler: async (ctx) => {
		const expiredTokens = await ctx.db
			.query('providerTokens')
			.withIndex('by_expiresAt', (query) => query.lte('expiresAt', Date.now()))
			.collect();

		for (const token of expiredTokens) {
			await ctx.db.delete(token._id);
		}

		return {
			deletedCount: expiredTokens.length
		};
	}
});

export const storeSearchCache = internalMutation({
	args: {
		roomId: v.id('rooms'),
		provider: providerValidator,
		normalizedQuery: v.string(),
		results: v.array(cachedSearchResultValidator)
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_roomId_provider_normalizedQuery', (query) =>
				query
					.eq('roomId', args.roomId)
					.eq('provider', args.provider)
					.eq('normalizedQuery', args.normalizedQuery)
			)
			.unique();
		const now = Date.now();

		if (existing) {
			const createdAt =
				existing.expiresAt <= now ? now : (existing.createdAt ?? existing.updatedAt ?? now);

			await ctx.db.patch(existing._id, {
				results: args.results,
				createdAt,
				expiresAt: createdAt + PROVIDER_SEARCH_CACHE_TTL_MS,
				updatedAt: now
			});
			return;
		}

		await ctx.db.insert('providerSearchCache', {
			roomId: args.roomId,
			provider: args.provider,
			normalizedQuery: args.normalizedQuery,
			results: args.results,
			createdAt: now,
			expiresAt: now + PROVIDER_SEARCH_CACHE_TTL_MS,
			updatedAt: now
		});
	}
});

export const getTokenRecord = internalQuery({
	args: {
		roomId: v.id('rooms'),
		provider: providerValidator
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query('providerTokens')
			.withIndex('by_roomId_provider', (query) =>
				query.eq('roomId', args.roomId).eq('provider', args.provider)
			)
			.unique();
	}
});

export const storeToken = internalMutation({
	args: {
		roomId: v.id('rooms'),
		provider: providerValidator,
		accessToken: v.string(),
		refreshToken: v.optional(nullableStringValidator),
		expiresAt: v.number()
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('providerTokens')
			.withIndex('by_roomId_provider', (query) =>
				query.eq('roomId', args.roomId).eq('provider', args.provider)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				updatedAt: Date.now()
			});
			return;
		}

		await ctx.db.insert('providerTokens', {
			roomId: args.roomId,
			provider: args.provider,
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			updatedAt: Date.now()
		});
	}
});

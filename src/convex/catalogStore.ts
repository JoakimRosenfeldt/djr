import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import { requireRoomBySlug } from './lib/auth';
import { SOUNDCLOUD_SEARCH_CACHE_TTL_MS } from './lib/constants';
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
		const requests = await ctx.db
			.query('requests')
			.withIndex('by_roomId_status', (query) => query.eq('roomId', room._id).eq('status', 'active'))
			.collect();
		const played = await ctx.db
			.query('requests')
			.withIndex('by_roomId_status', (query) => query.eq('roomId', room._id).eq('status', 'played'))
			.collect();

		return {
			activeTrackKeys: requests.map((request) => request.sourceTrackKey),
			playedTrackKeys: played.map((request) => request.sourceTrackKey)
		};
	}
});

export const getCachedSearch = internalQuery({
	args: {
		provider: providerValidator,
		normalizedQuery: v.string()
	},
	handler: async (ctx, args) => {
		const cached = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_provider_normalizedQuery', (query) =>
				query.eq('provider', args.provider).eq('normalizedQuery', args.normalizedQuery)
			)
			.unique();

		if (!cached || cached.expiresAt <= Date.now()) {
			return null;
		}

		return cached;
	}
});

export const storeSearchCache = internalMutation({
	args: {
		provider: providerValidator,
		normalizedQuery: v.string(),
		results: v.array(cachedSearchResultValidator)
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('providerSearchCache')
			.withIndex('by_provider_normalizedQuery', (query) =>
				query.eq('provider', args.provider).eq('normalizedQuery', args.normalizedQuery)
			)
			.unique();
		const updatedAt = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				results: args.results,
				expiresAt: updatedAt + SOUNDCLOUD_SEARCH_CACHE_TTL_MS,
				updatedAt
			});
			return;
		}

		await ctx.db.insert('providerSearchCache', {
			provider: args.provider,
			normalizedQuery: args.normalizedQuery,
			results: args.results,
			expiresAt: updatedAt + SOUNDCLOUD_SEARCH_CACHE_TTL_MS,
			updatedAt
		});
	}
});

export const getTokenRecord = internalQuery({
	args: {
		provider: providerValidator
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query('providerTokens')
			.withIndex('by_provider_key', (query) =>
				query.eq('provider', args.provider).eq('key', 'default')
			)
			.unique();
	}
});

export const storeToken = internalMutation({
	args: {
		provider: providerValidator,
		accessToken: v.string(),
		refreshToken: v.optional(nullableStringValidator),
		expiresAt: v.number()
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('providerTokens')
			.withIndex('by_provider_key', (query) =>
				query.eq('provider', args.provider).eq('key', 'default')
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
			provider: args.provider,
			key: 'default',
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			updatedAt: Date.now()
		});
	}
});

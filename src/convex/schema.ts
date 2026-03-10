import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
	cachedSearchResultValidator,
	nullableStringValidator,
	providerCredentialsValidator,
	providerValidator,
	roomColorValidator,
	requestStatusValidator,
	roomStatusValidator
} from './lib/validators';

export default defineSchema({
	rooms: defineTable({
		slug: v.string(),
		eventName: v.string(),
		djName: v.string(),
		color: v.optional(roomColorValidator),
		enabledProviders: v.optional(v.array(providerValidator)),
		soundcloudCredentials: v.optional(providerCredentialsValidator),
		spotifyCredentials: v.optional(providerCredentialsValidator),
		status: roomStatusValidator,
		createdAt: v.number(),
		closedAt: v.optional(v.number()),
		pinHash: v.string()
	}).index('by_slug', ['slug']),

	adminLinkTokens: defineTable({
		roomId: v.id('rooms'),
		tokenHash: v.string(),
		expiresAt: v.number(),
		usedAt: v.optional(v.number())
	})
		.index('by_roomId', ['roomId'])
		.index('by_tokenHash', ['tokenHash']),

	adminSessions: defineTable({
		roomId: v.id('rooms'),
		sessionTokenHash: v.string(),
		expiresAt: v.number(),
		createdAt: v.number(),
		lastSeenAt: v.number()
	})
		.index('by_tokenHash', ['sessionTokenHash'])
		.index('by_roomId', ['roomId']),

	requests: defineTable({
		roomId: v.id('rooms'),
		source: providerValidator,
		sourceTrackId: v.string(),
		sourceTrackKey: v.string(),
		title: v.string(),
		artistName: v.string(),
		artworkUrl: nullableStringValidator,
		durationMs: v.number(),
		permalinkUrl: v.string(),
		status: requestStatusValidator,
		createdAt: v.number(),
		playedAt: v.optional(v.number()),
		score: v.number(),
		upvoteCount: v.number(),
		downvoteCount: v.number(),
		lastVoteAt: v.number()
	})
		.index('by_roomId_status', ['roomId', 'status'])
		.index('by_roomId_sourceTrackKey', ['roomId', 'sourceTrackKey']),

	votes: defineTable({
		roomId: v.id('rooms'),
		requestId: v.id('requests'),
		guestId: v.string(),
		value: v.union(v.literal(-1), v.literal(1)),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_requestId_guestId', ['requestId', 'guestId'])
		.index('by_roomId_guestId', ['roomId', 'guestId']),

	providerTokens: defineTable({
		roomId: v.optional(v.id('rooms')),
		provider: providerValidator,
		key: v.optional(v.string()),
		accessToken: v.string(),
		refreshToken: v.optional(nullableStringValidator),
		expiresAt: v.number(),
		updatedAt: v.number()
	}).index('by_roomId_provider', ['roomId', 'provider']),

	providerSearchCache: defineTable({
		roomId: v.optional(v.id('rooms')),
		provider: providerValidator,
		normalizedQuery: v.string(),
		results: v.array(cachedSearchResultValidator),
		expiresAt: v.number(),
		updatedAt: v.number()
	}).index('by_roomId_provider_normalizedQuery', ['roomId', 'provider', 'normalizedQuery'])
});

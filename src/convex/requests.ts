import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { requireAdminSession, requireRoomBySlug } from './lib/auth';
import { recomputeRequestAggregates } from './lib/requests';
import { trackSnapshotValidator } from './lib/validators';

export const addOrVote = mutation({
	args: {
		roomSlug: v.string(),
		guestId: v.string(),
		track: trackSnapshotValidator
	},
	handler: async (ctx, args) => {
		const room = await requireRoomBySlug(ctx.db, args.roomSlug);
		const existingRequest = await ctx.db
			.query('requests')
			.withIndex('by_roomId_sourceTrackKey', (query) =>
				query.eq('roomId', room._id).eq('sourceTrackKey', args.track.sourceTrackKey)
			)
			.unique();

		const now = Date.now();

		if (existingRequest?.status === 'played') {
			throw new Error('That song has already been played in this room.');
		}

		if (existingRequest?.status === 'active') {
			const existingVote = await ctx.db
				.query('votes')
				.withIndex('by_requestId_guestId', (query) =>
					query.eq('requestId', existingRequest._id).eq('guestId', args.guestId)
				)
				.unique();

			if (existingVote) {
				if (existingVote.value !== 1) {
					await ctx.db.patch(existingVote._id, {
						value: 1,
						updatedAt: now
					});
				}
			} else {
				await ctx.db.insert('votes', {
					roomId: room._id,
					requestId: existingRequest._id,
					guestId: args.guestId,
					value: 1,
					createdAt: now,
					updatedAt: now
				});
			}

			await recomputeRequestAggregates(ctx.db, existingRequest._id);

			return {
				requestId: existingRequest._id,
				created: false
			};
		}

		const requestId = await ctx.db.insert('requests', {
			roomId: room._id,
			source: args.track.source,
			sourceTrackId: args.track.sourceTrackId,
			sourceTrackKey: args.track.sourceTrackKey,
			title: args.track.title,
			artistName: args.track.artistName,
			artworkUrl: args.track.artworkUrl,
			durationMs: args.track.durationMs,
			permalinkUrl: args.track.permalinkUrl,
			status: 'active',
			createdAt: now,
			score: 0,
			upvoteCount: 0,
			downvoteCount: 0,
			lastVoteAt: now
		});

		await ctx.db.insert('votes', {
			roomId: room._id,
			requestId,
			guestId: args.guestId,
			value: 1,
			createdAt: now,
			updatedAt: now
		});

		await recomputeRequestAggregates(ctx.db, requestId);

		return {
			requestId,
			created: true
		};
	}
});

export const markPlayed = mutation({
	args: {
		requestId: v.id('requests'),
		adminSessionToken: v.string()
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);

		if (!request) {
			throw new Error('That request no longer exists.');
		}

		await requireAdminSession(ctx.db, request.roomId, args.adminSessionToken);

		if (request.status === 'played') {
			return { success: true };
		}

		await ctx.db.patch(request._id, {
			status: 'played',
			playedAt: Date.now()
		});

		return { success: true };
	}
});

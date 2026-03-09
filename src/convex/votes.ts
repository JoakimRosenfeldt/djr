import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { recomputeRequestAggregates } from './lib/requests';

export const setVote = mutation({
	args: {
		requestId: v.id('requests'),
		guestId: v.string(),
		value: v.union(v.literal(-1), v.literal(0), v.literal(1))
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);

		if (!request) {
			throw new Error('That request no longer exists.');
		}

		if (request.status === 'played') {
			throw new Error('Played songs can no longer be voted on.');
		}

		const existingVote = await ctx.db
			.query('votes')
			.withIndex('by_requestId_guestId', (query) =>
				query.eq('requestId', args.requestId).eq('guestId', args.guestId)
			)
			.unique();

		const now = Date.now();

		if (args.value === 0) {
			if (existingVote) {
				await ctx.db.delete(existingVote._id);
			}
		} else if (existingVote) {
			await ctx.db.patch(existingVote._id, {
				value: args.value,
				updatedAt: now
			});
		} else {
			await ctx.db.insert('votes', {
				roomId: request.roomId,
				requestId: request._id,
				guestId: args.guestId,
				value: args.value,
				createdAt: now,
				updatedAt: now
			});
		}

		await recomputeRequestAggregates(ctx.db, request._id);

		return {
			success: true
		};
	}
});

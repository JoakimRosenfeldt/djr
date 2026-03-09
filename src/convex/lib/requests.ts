import type { Doc, Id } from '../_generated/dataModel';
import type { DatabaseReader, DatabaseWriter } from '../_generated/server';

type Db = DatabaseReader | DatabaseWriter;

export async function listRequestsByStatus(
	db: Db,
	roomId: Id<'rooms'>,
	status: Doc<'requests'>['status']
) {
	return db
		.query('requests')
		.withIndex('by_roomId_status', (query) => query.eq('roomId', roomId).eq('status', status))
		.collect();
}

export async function getViewerVotes(db: Db, roomId: Id<'rooms'>, guestId?: string) {
	if (!guestId) {
		return new Map<Id<'requests'>, -1 | 1>();
	}

	const votes = await db
		.query('votes')
		.withIndex('by_roomId_guestId', (query) => query.eq('roomId', roomId).eq('guestId', guestId))
		.collect();

	return new Map(votes.map((vote) => [vote.requestId, vote.value] as const));
}

export function sortActiveRequests<
	T extends {
		score: number;
		upvoteCount: number;
		downvoteCount: number;
		createdAt: number;
	}
>(requests: T[]) {
	return [...requests].sort((left, right) => {
		const scoreDelta = right.score - left.score;
		if (scoreDelta !== 0) {
			return scoreDelta;
		}

		const activityDelta =
			right.upvoteCount + right.downvoteCount - (left.upvoteCount + left.downvoteCount);
		if (activityDelta !== 0) {
			return activityDelta;
		}

		return left.createdAt - right.createdAt;
	});
}

export async function recomputeRequestAggregates(db: DatabaseWriter, requestId: Id<'requests'>) {
	const votes = await db
		.query('votes')
		.withIndex('by_requestId_guestId', (query) => query.eq('requestId', requestId))
		.collect();

	let score = 0;
	let upvoteCount = 0;
	let downvoteCount = 0;
	let lastVoteAt = 0;

	for (const vote of votes) {
		score += vote.value;
		if (vote.value > 0) {
			upvoteCount += 1;
		} else {
			downvoteCount += 1;
		}
		lastVoteAt = Math.max(lastVoteAt, vote.updatedAt);
	}

	await db.patch(requestId, {
		score,
		upvoteCount,
		downvoteCount,
		lastVoteAt
	});

	return { score, upvoteCount, downvoteCount, lastVoteAt };
}

export function toPublicRequest(request: Doc<'requests'>, viewerVote?: -1 | 1) {
	return {
		id: request._id,
		source: request.source,
		sourceTrackId: request.sourceTrackId,
		sourceTrackKey: request.sourceTrackKey,
		title: request.title,
		artistName: request.artistName,
		artworkUrl: request.artworkUrl,
		durationMs: request.durationMs,
		permalinkUrl: request.permalinkUrl,
		status: request.status,
		viewerVote: viewerVote ?? 0
	};
}

export function toAdminRequest(request: Doc<'requests'>) {
	return {
		id: request._id,
		source: request.source,
		sourceTrackId: request.sourceTrackId,
		sourceTrackKey: request.sourceTrackKey,
		title: request.title,
		artistName: request.artistName,
		artworkUrl: request.artworkUrl,
		durationMs: request.durationMs,
		permalinkUrl: request.permalinkUrl,
		status: request.status,
		score: request.score,
		createdAt: request.createdAt,
		playedAt: request.playedAt ?? null,
		totalVotes: request.upvoteCount + request.downvoteCount
	};
}

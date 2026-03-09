'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action, type ActionCtx } from './_generated/server';
import { makeSourceTrackKey, normalizeQuery } from './lib/helpers';
import { SOUNDCLOUD_TOKEN_REFRESH_BUFFER_MS } from './lib/constants';

type Provider = 'soundcloud' | 'spotify';

type SearchTrack = {
	source: Provider;
	sourceTrackId: string;
	sourceTrackKey: string;
	title: string;
	artistName: string;
	artworkUrl: string | null;
	durationMs: number;
	permalinkUrl: string;
};

type SearchTrackResult = SearchTrack & {
	alreadyQueued: boolean;
	alreadyPlayed: boolean;
};

type RankedSearchTrackResult = SearchTrackResult & {
	rankScore: number;
	originalIndex: number;
};

type RawSoundCloudTrack = {
	urn?: string;
	id?: number | string;
	title?: string;
	duration?: number;
	permalink_url?: string;
	artwork_url?: string | null;
	user?: {
		username?: string;
	};
	publisher_metadata?: {
		artist?: string;
	};
};

type RawSpotifyTrack = {
	id?: string;
	name?: string;
	duration_ms?: number;
	external_urls?: {
		spotify?: string;
	};
	album?: {
		images?: Array<{
			url?: string;
		}>;
	};
	artists?: Array<{
		name?: string;
	}>;
};

function normalizeSearchText(value: string) {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function countTokenMatches(haystack: string, tokens: string[]) {
	let matches = 0;

	for (const token of tokens) {
		if (haystack.includes(token)) {
			matches += 1;
		}
	}

	return matches;
}

function rankTrack(
	track: SearchTrackResult,
	query: string,
	queryTokens: string[],
	index: number
): RankedSearchTrackResult {
	const normalizedTitle = normalizeSearchText(track.title);
	const normalizedArtist = normalizeSearchText(track.artistName);
	let rankScore = 0;

	if (track.alreadyQueued) {
		rankScore += 140;
	}

	if (track.alreadyPlayed) {
		rankScore -= 140;
	}

	if (normalizedTitle === query) {
		rankScore += 120;
	}

	if (normalizedArtist === query) {
		rankScore += 90;
	}

	if (normalizedTitle.startsWith(query)) {
		rankScore += 35;
	}

	if (normalizedArtist.startsWith(query)) {
		rankScore += 22;
	}

	const titleMatches = countTokenMatches(normalizedTitle, queryTokens);
	const artistMatches = countTokenMatches(normalizedArtist, queryTokens);
	rankScore += titleMatches * 18;
	rankScore += artistMatches * 12;

	if (track.artworkUrl) {
		rankScore += 4;
	}

	if (track.durationMs >= 90_000 && track.durationMs <= 480_000) {
		rankScore += 6;
	}

	const noisyDescriptors = ['remix', 'live', 'edit', 'sped up', 'slowed', 'bootleg', 'cover'];
	for (const descriptor of noisyDescriptors) {
		const descriptorInQuery = query.includes(descriptor);
		const descriptorInTrack =
			normalizedTitle.includes(descriptor) || normalizedArtist.includes(descriptor);

		if (descriptorInTrack && !descriptorInQuery) {
			rankScore -= 10;
		}
	}

	if (track.source === 'soundcloud' && titleMatches + artistMatches > 0) {
		rankScore += 2;
	}

	return {
		...track,
		rankScore,
		originalIndex: index
	};
}

function sortRankedTracks(left: RankedSearchTrackResult, right: RankedSearchTrackResult) {
	const scoreDelta = right.rankScore - left.rankScore;
	if (scoreDelta !== 0) {
		return scoreDelta;
	}

	if (left.alreadyQueued !== right.alreadyQueued) {
		return left.alreadyQueued ? -1 : 1;
	}

	if (left.alreadyPlayed !== right.alreadyPlayed) {
		return left.alreadyPlayed ? 1 : -1;
	}

	return left.originalIndex - right.originalIndex;
}

function mapSoundCloudTrack(track: RawSoundCloudTrack): SearchTrack | null {
	const sourceTrackId =
		track.urn ?? (track.id ? `soundcloud:tracks:${String(track.id)}` : undefined);
	const title = track.title?.trim();
	const permalinkUrl = track.permalink_url?.trim();

	if (!sourceTrackId || !title || !permalinkUrl) {
		return null;
	}

	return {
		source: 'soundcloud',
		sourceTrackId,
		sourceTrackKey: makeSourceTrackKey('soundcloud', sourceTrackId),
		title,
		artistName:
			track.publisher_metadata?.artist?.trim() || track.user?.username?.trim() || 'Unknown artist',
		artworkUrl: track.artwork_url ?? null,
		durationMs: track.duration ?? 0,
		permalinkUrl
	};
}

function mapSpotifyTrack(track: RawSpotifyTrack): SearchTrack | null {
	const sourceTrackId = track.id?.trim();
	const title = track.name?.trim();
	const permalinkUrl = track.external_urls?.spotify?.trim();

	if (!sourceTrackId || !title || !permalinkUrl) {
		return null;
	}

	const artistName = track.artists
		?.map((artist) => artist.name?.trim())
		.filter((name): name is string => Boolean(name))
		.join(', ');

	return {
		source: 'spotify',
		sourceTrackId,
		sourceTrackKey: makeSourceTrackKey('spotify', sourceTrackId),
		title,
		artistName: artistName || 'Unknown artist',
		artworkUrl: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
		durationMs: track.duration_ms ?? 0,
		permalinkUrl
	};
}

async function ensureSoundCloudAccessToken(ctx: ActionCtx) {
	const cachedToken = await ctx.runQuery(internal.catalogStore.getTokenRecord, {
		provider: 'soundcloud'
	});

	if (cachedToken && cachedToken.expiresAt > Date.now() + SOUNDCLOUD_TOKEN_REFRESH_BUFFER_MS) {
		return cachedToken.accessToken;
	}

	const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
	const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('SoundCloud credentials are not configured in Convex.');
	}

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret
	});

	const response = await fetch('https://api.soundcloud.com/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(
			`Unable to authenticate with SoundCloud (${response.status}). ${details || 'Check your SoundCloud client credentials.'}`
		);
	}

	const payload = await response.json();
	const expiresAt = Date.now() + Number(payload.expires_in ?? 3600) * 1000;

	await ctx.runMutation(internal.catalogStore.storeToken, {
		provider: 'soundcloud',
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? null,
		expiresAt
	});

	return payload.access_token as string;
}

async function ensureSpotifyAccessToken(ctx: ActionCtx) {
	const cachedToken = await ctx.runQuery(internal.catalogStore.getTokenRecord, {
		provider: 'spotify'
	});

	if (cachedToken && cachedToken.expiresAt > Date.now() + SOUNDCLOUD_TOKEN_REFRESH_BUFFER_MS) {
		return cachedToken.accessToken;
	}

	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('Spotify credentials are not configured in Convex.');
	}

	const basicToken = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const body = new URLSearchParams({
		grant_type: 'client_credentials'
	});

	const response = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basicToken}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(
			`Unable to authenticate with Spotify (${response.status}). ${details || 'Check your Spotify client credentials.'}`
		);
	}

	const payload = await response.json();
	const expiresAt = Date.now() + Number(payload.expires_in ?? 3600) * 1000;

	await ctx.runMutation(internal.catalogStore.storeToken, {
		provider: 'spotify',
		accessToken: payload.access_token,
		refreshToken: null,
		expiresAt
	});

	return payload.access_token as string;
}

async function searchSoundCloud(
	ctx: ActionCtx,
	normalizedQuery: string,
	rawQuery: string
): Promise<SearchTrack[]> {
	const cachedSearch = await ctx.runQuery(internal.catalogStore.getCachedSearch, {
		provider: 'soundcloud',
		normalizedQuery
	});

	if (cachedSearch) {
		return cachedSearch.results;
	}

	const accessToken = await ensureSoundCloudAccessToken(ctx);
	const params = new URLSearchParams({
		q: rawQuery.trim(),
		limit: '8',
		linked_partitioning: '1'
	});

	const response = await fetch(`https://api.soundcloud.com/tracks?${params.toString()}`, {
		headers: {
			Authorization: `OAuth ${accessToken}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error('SoundCloud search is unavailable right now.');
	}

	const payload = await response.json();
	const collection: RawSoundCloudTrack[] = Array.isArray(payload.collection)
		? payload.collection
		: Array.isArray(payload)
			? payload
			: [];

	const results = collection
		.map((track) => mapSoundCloudTrack(track))
		.filter((track): track is SearchTrack => track !== null)
		.slice(0, 8);

	await ctx.runMutation(internal.catalogStore.storeSearchCache, {
		provider: 'soundcloud',
		normalizedQuery,
		results
	});

	return results;
}

async function searchSpotify(
	ctx: ActionCtx,
	normalizedQuery: string,
	rawQuery: string
): Promise<SearchTrack[]> {
	const cachedSearch = await ctx.runQuery(internal.catalogStore.getCachedSearch, {
		provider: 'spotify',
		normalizedQuery
	});

	if (cachedSearch) {
		return cachedSearch.results;
	}

	const accessToken = await ensureSpotifyAccessToken(ctx);
	const params = new URLSearchParams({
		q: rawQuery.trim(),
		type: 'track',
		limit: '8'
	});

	const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error('Spotify search is unavailable right now.');
	}

	const payload = await response.json();
	const collection: RawSpotifyTrack[] = Array.isArray(payload.tracks?.items)
		? payload.tracks.items
		: [];

	const results = collection
		.map((track) => mapSpotifyTrack(track))
		.filter((track): track is SearchTrack => track !== null)
		.slice(0, 8);

	await ctx.runMutation(internal.catalogStore.storeSearchCache, {
		provider: 'spotify',
		normalizedQuery,
		results
	});

	return results;
}

function annotateTrackState(
	track: SearchTrack,
	activeTrackKeys: Set<string>,
	playedTrackKeys: Set<string>
): SearchTrackResult {
	return {
		...track,
		alreadyQueued: activeTrackKeys.has(track.sourceTrackKey),
		alreadyPlayed: playedTrackKeys.has(track.sourceTrackKey)
	};
}

export const searchTracks = action({
	args: {
		roomSlug: v.string(),
		query: v.string()
	},
	handler: async (ctx, args): Promise<SearchTrackResult[]> => {
		const normalizedQuery = normalizeQuery(args.query);

		if (normalizedQuery.length < 2) {
			return [];
		}

		const roomState = (await ctx.runQuery(internal.catalogStore.getRoomTrackStates, {
			roomSlug: args.roomSlug
		})) as {
			activeTrackKeys: string[];
			playedTrackKeys: string[];
		};
		const [soundCloudResults, spotifyResults] = await Promise.all([
			searchSoundCloud(ctx, normalizedQuery, args.query),
			searchSpotify(ctx, normalizedQuery, args.query)
		]);

		const activeTrackKeys = new Set(roomState.activeTrackKeys);
		const playedTrackKeys = new Set(roomState.playedTrackKeys);
		const combinedResults = [...soundCloudResults, ...spotifyResults];
		const queryTokens = normalizedQuery.split(' ').filter(Boolean);

		return combinedResults
			.map((track, index) =>
				rankTrack(
					annotateTrackState(track, activeTrackKeys, playedTrackKeys),
					normalizedQuery,
					queryTokens,
					index
				)
			)
			.sort(sortRankedTracks)
			.map(({ rankScore: _rankScore, originalIndex: _originalIndex, ...track }) => track);
	}
});

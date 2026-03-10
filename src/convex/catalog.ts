'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
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

type ProviderCredentials = {
	clientId: string;
	clientSecret: string;
};

type RoomCatalogState = {
	roomId: Id<'rooms'>;
	enabledProviders: Provider[];
	soundcloudCredentials: ProviderCredentials | null;
	spotifyCredentials: ProviderCredentials | null;
	activeTrackKeys: string[];
	playedTrackKeys: string[];
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
		rankScore += 220;
	}

	if (track.alreadyPlayed) {
		rankScore += 180;
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

	if (track.source === 'spotify') {
		rankScore += 8;
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

	const leftRequested = left.alreadyQueued || left.alreadyPlayed;
	const rightRequested = right.alreadyQueued || right.alreadyPlayed;

	if (leftRequested !== rightRequested) {
		return leftRequested ? -1 : 1;
	}

	if (left.alreadyQueued !== right.alreadyQueued) {
		return left.alreadyQueued ? -1 : 1;
	}

	if (left.alreadyPlayed !== right.alreadyPlayed) {
		return left.alreadyPlayed ? -1 : 1;
	}

	if (left.source !== right.source) {
		return left.source === 'spotify' ? -1 : 1;
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

function trimCredentials(credentials: ProviderCredentials | null | undefined) {
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

function getProviderCredentials(roomState: RoomCatalogState, provider: Provider): ProviderCredentials {
	if (provider === 'soundcloud') {
		const roomCredentials = trimCredentials(roomState.soundcloudCredentials);

		if (roomCredentials) {
			return roomCredentials;
		}

		const envCredentials = trimCredentials({
			clientId: process.env.SOUNDCLOUD_CLIENT_ID ?? '',
			clientSecret: process.env.SOUNDCLOUD_CLIENT_SECRET ?? ''
		});

		if (envCredentials) {
			return envCredentials;
		}

		throw new Error('SoundCloud credentials are not configured for this room.');
	}

	const roomCredentials = trimCredentials(roomState.spotifyCredentials);

	if (roomCredentials) {
		return roomCredentials;
	}

	const envCredentials = trimCredentials({
		clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
		clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? ''
	});

	if (envCredentials) {
		return envCredentials;
	}

	throw new Error('Spotify credentials are not configured for this room.');
}

async function ensureSoundCloudAccessToken(
	ctx: ActionCtx,
	roomId: Id<'rooms'>,
	credentials: ProviderCredentials
) {
	const cachedToken = await ctx.runQuery(internal.catalogStore.getTokenRecord, {
		roomId,
		provider: 'soundcloud'
	});

	if (cachedToken && cachedToken.expiresAt > Date.now() + SOUNDCLOUD_TOKEN_REFRESH_BUFFER_MS) {
		return cachedToken.accessToken;
	}

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret
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
		roomId,
		provider: 'soundcloud',
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token ?? null,
		expiresAt
	});

	return payload.access_token as string;
}

async function ensureSpotifyAccessToken(
	ctx: ActionCtx,
	roomId: Id<'rooms'>,
	credentials: ProviderCredentials
) {
	const cachedToken = await ctx.runQuery(internal.catalogStore.getTokenRecord, {
		roomId,
		provider: 'spotify'
	});

	if (cachedToken && cachedToken.expiresAt > Date.now() + SOUNDCLOUD_TOKEN_REFRESH_BUFFER_MS) {
		return cachedToken.accessToken;
	}

	const basicToken = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
		'base64'
	);
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
		roomId,
		provider: 'spotify',
		accessToken: payload.access_token,
		refreshToken: null,
		expiresAt
	});

	return payload.access_token as string;
}

async function searchSoundCloud(
	ctx: ActionCtx,
	roomId: Id<'rooms'>,
	normalizedQuery: string,
	rawQuery: string,
	credentials: ProviderCredentials
): Promise<SearchTrack[]> {
	const cachedSearch = await ctx.runQuery(internal.catalogStore.getCachedSearch, {
		roomId,
		provider: 'soundcloud',
		normalizedQuery
	});

	if (cachedSearch) {
		return cachedSearch.results;
	}

	const accessToken = await ensureSoundCloudAccessToken(ctx, roomId, credentials);
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
		roomId,
		provider: 'soundcloud',
		normalizedQuery,
		results
	});

	return results;
}

async function searchSpotify(
	ctx: ActionCtx,
	roomId: Id<'rooms'>,
	normalizedQuery: string,
	rawQuery: string,
	credentials: ProviderCredentials
): Promise<SearchTrack[]> {
	const cachedSearch = await ctx.runQuery(internal.catalogStore.getCachedSearch, {
		roomId,
		provider: 'spotify',
		normalizedQuery
	});

	if (cachedSearch) {
		return cachedSearch.results;
	}

	const accessToken = await ensureSpotifyAccessToken(ctx, roomId, credentials);
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
		roomId,
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
		})) as RoomCatalogState;
		const searchJobs: Array<Promise<SearchTrack[]>> = [];

		if (roomState.enabledProviders.includes('soundcloud')) {
			searchJobs.push(
				searchSoundCloud(
					ctx,
					roomState.roomId,
					normalizedQuery,
					args.query,
					getProviderCredentials(roomState, 'soundcloud')
				)
			);
		}

		if (roomState.enabledProviders.includes('spotify')) {
			searchJobs.push(
				searchSpotify(
					ctx,
					roomState.roomId,
					normalizedQuery,
					args.query,
					getProviderCredentials(roomState, 'spotify')
				)
			);
		}

		if (searchJobs.length === 0) {
			throw new Error('No music providers are enabled for this room.');
		}

		const resultsByProvider = await Promise.all(searchJobs);

		const activeTrackKeys = new Set(roomState.activeTrackKeys);
		const playedTrackKeys = new Set(roomState.playedTrackKeys);
		const combinedResults = resultsByProvider.flat();
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

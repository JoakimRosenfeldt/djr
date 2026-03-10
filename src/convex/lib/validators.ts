import { v } from 'convex/values';

export const roomStatusValidator = v.union(v.literal('active'), v.literal('closed'));
export const roomColorValidator = v.union(
	v.literal('purple'),
	v.literal('sunset'),
	v.literal('ocean'),
	v.literal('lime')
);
export const requestStatusValidator = v.union(v.literal('active'), v.literal('played'));
export const nullableStringValidator = v.union(v.string(), v.null());
export const providerValidator = v.union(v.literal('soundcloud'), v.literal('spotify'));
export const providerCredentialsValidator = v.object({
	clientId: v.string(),
	clientSecret: v.string()
});

export const trackSnapshotValidator = v.object({
	source: providerValidator,
	sourceTrackId: v.string(),
	sourceTrackKey: v.string(),
	title: v.string(),
	artistName: v.string(),
	artworkUrl: nullableStringValidator,
	durationMs: v.number(),
	permalinkUrl: v.string()
});

export const cachedSearchResultValidator = v.object({
	source: providerValidator,
	sourceTrackId: v.string(),
	sourceTrackKey: v.string(),
	title: v.string(),
	artistName: v.string(),
	artworkUrl: nullableStringValidator,
	durationMs: v.number(),
	permalinkUrl: v.string()
});

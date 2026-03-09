import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';

export function createConvexHttpClient() {
	if (!PUBLIC_CONVEX_URL) {
		throw new Error('PUBLIC_CONVEX_URL is not configured.');
	}

	return new ConvexHttpClient(PUBLIC_CONVEX_URL);
}

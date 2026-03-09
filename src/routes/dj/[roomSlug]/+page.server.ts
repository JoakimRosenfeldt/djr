import type { PageServerLoad } from './$types';
import { api } from '$lib/convexApi';
import { createConvexHttpClient } from '$lib/server/convex';
import { getAdminCookieName } from '$lib/constants';

export const load = (async ({ params, cookies, url }) => {
	const client = createConvexHttpClient();
	const adminSessionToken = cookies.get(getAdminCookieName(params.roomSlug));

	if (!adminSessionToken) {
		return {
			initialRoom: null,
			initialAdminToken: null,
			initialError: null,
			incomingToken: url.searchParams.get('token'),
			roomSlug: params.roomSlug
		};
	}

	try {
		const initialRoom = await client.query(api.rooms.getAdminRoom, {
			slug: params.roomSlug,
			adminSessionToken
		});

		return {
			initialRoom,
			initialAdminToken: adminSessionToken,
			initialError: null,
			incomingToken: url.searchParams.get('token'),
			roomSlug: params.roomSlug
		};
	} catch (error) {
		return {
			initialRoom: null,
			initialAdminToken: null,
			initialError: error instanceof Error ? error.message : 'Unable to load DJ room.',
			incomingToken: url.searchParams.get('token'),
			roomSlug: params.roomSlug
		};
	}
}) satisfies PageServerLoad;

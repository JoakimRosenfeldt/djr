import type { PageServerLoad } from './$types';
import { api } from '$lib/convexApi';
import { GUEST_COOKIE_NAME } from '$lib/constants';
import { createConvexHttpClient } from '$lib/server/convex';

export const load = (async ({ params, cookies }) => {
	const client = createConvexHttpClient();
	const guestId = cookies.get(GUEST_COOKIE_NAME);

	try {
		const initialRoom = await client.query(api.rooms.getPublicRoom, {
			slug: params.roomSlug,
			guestId
		});

		return {
			initialRoom,
			initialGuestId: guestId ?? null,
			initialError: null,
			roomSlug: params.roomSlug
		};
	} catch (error) {
		return {
			initialRoom: null,
			initialGuestId: guestId ?? null,
			initialError: error instanceof Error ? error.message : 'Unable to load room.',
			roomSlug: params.roomSlug
		};
	}
}) satisfies PageServerLoad;

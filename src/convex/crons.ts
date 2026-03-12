import { internal } from './_generated/api';
import { cronJobs } from 'convex/server';

const crons = cronJobs();

crons.interval(
	'delete expired provider search caches',
	{ minutes: 15 },
	internal.catalogStore.cleanupExpiredSearchCaches
);

crons.interval(
	'delete expired provider tokens',
	{ minutes: 15 },
	internal.catalogStore.cleanupExpiredProviderTokens
);

export default crons;

export function formatDuration(durationMs: number) {
	const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatRelativeDate(timestamp: number | null) {
	if (!timestamp) {
		return 'Just now';
	}

	return new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(timestamp);
}

export function formatSourceLabel(source: 'soundcloud' | 'spotify') {
	return source === 'soundcloud' ? 'SoundCloud' : 'Spotify';
}

export function truncateText(value: string, maxLength: number) {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

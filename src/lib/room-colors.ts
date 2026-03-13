export const ROOM_COLOR_OPTIONS = [
	{
		id: 'purple',
		label: 'Purple',
		description: 'Muted plum with a softer late-night tone.',
		swatch: 'linear-gradient(135deg, #716084 0%, #a795ba 100%)',
		accent: '#8f7aa6',
		accentSoft: '#d9cfe5',
		glowStrong: 'rgba(143, 122, 166, 0.14)',
		glowSoft: 'rgba(217, 207, 229, 0.08)',
		backgroundTop: '#16121c',
		backgroundBottom: '#0e0c12'
	},
	{
		id: 'sunset',
		label: 'Sunset',
		description: 'Warm clay and blush, kept understated.',
		swatch: 'linear-gradient(135deg, #af7055 0%, #c69287 100%)',
		accent: '#b98368',
		accentSoft: '#dcc0b2',
		glowStrong: 'rgba(185, 131, 104, 0.14)',
		glowSoft: 'rgba(220, 192, 178, 0.08)',
		backgroundTop: '#171210',
		backgroundBottom: '#0e0c0b'
	},
	{
		id: 'ocean',
		label: 'Ocean',
		description: 'Slate blue with a washed coastal accent.',
		swatch: 'linear-gradient(135deg, #4b7280 0%, #7fa2b1 100%)',
		accent: '#6f98a7',
		accentSoft: '#cadce3',
		glowStrong: 'rgba(111, 152, 167, 0.13)',
		glowSoft: 'rgba(202, 220, 227, 0.08)',
		backgroundTop: '#10171b',
		backgroundBottom: '#0a0f12'
	},
	{
		id: 'lime',
		label: 'Lime',
		description: 'Olive and mineral green with lower contrast.',
		swatch: 'linear-gradient(135deg, #6f8150 0%, #93a387 100%)',
		accent: '#8d9d73',
		accentSoft: '#d3dcc4',
		glowStrong: 'rgba(141, 157, 115, 0.12)',
		glowSoft: 'rgba(211, 220, 196, 0.08)',
		backgroundTop: '#13170f',
		backgroundBottom: '#0b0d09'
	}
] as const;

export type RoomColorId = (typeof ROOM_COLOR_OPTIONS)[number]['id'];

export const DEFAULT_ROOM_COLOR: RoomColorId = 'purple';

export function getRoomColorOption(colorId?: string | null) {
	return ROOM_COLOR_OPTIONS.find((option) => option.id === colorId) ?? ROOM_COLOR_OPTIONS[0];
}

export function getRoomThemeStyle(colorId?: string | null) {
	const theme = getRoomColorOption(colorId);

	return [
		`--color-accent: ${theme.accent}`,
		`--color-accent-soft: ${theme.accentSoft}`,
		`background: radial-gradient(circle at top left, ${theme.glowStrong}, transparent 36%), radial-gradient(circle at 80% 18%, ${theme.glowSoft}, transparent 28%), linear-gradient(180deg, ${theme.backgroundTop} 0%, ${theme.backgroundBottom} 100%)`
	].join('; ');
}

export const ROOM_COLOR_OPTIONS = [
	{
		id: 'purple',
		label: 'Purple',
		description: 'Neon plum with a nightclub glow.',
		swatch: 'linear-gradient(135deg, #8b5cf6 0%, #c084fc 100%)',
		accent: '#a855f7',
		accentSoft: '#e9d5ff',
		glowStrong: 'rgba(168, 85, 247, 0.28)',
		glowSoft: 'rgba(221, 167, 255, 0.18)',
		backgroundTop: '#140d1f',
		backgroundBottom: '#09070f'
	},
	{
		id: 'sunset',
		label: 'Sunset',
		description: 'Warm amber and coral tones.',
		swatch: 'linear-gradient(135deg, #f97316 0%, #fb7185 100%)',
		accent: '#ff7a45',
		accentSoft: '#ffc9a4',
		glowStrong: 'rgba(255, 122, 69, 0.28)',
		glowSoft: 'rgba(255, 201, 164, 0.18)',
		backgroundTop: '#140f0b',
		backgroundBottom: '#090909'
	},
	{
		id: 'ocean',
		label: 'Ocean',
		description: 'Electric cyan with a cooler wash.',
		swatch: 'linear-gradient(135deg, #06b6d4 0%, #60a5fa 100%)',
		accent: '#22d3ee',
		accentSoft: '#bae6fd',
		glowStrong: 'rgba(34, 211, 238, 0.24)',
		glowSoft: 'rgba(125, 211, 252, 0.18)',
		backgroundTop: '#07151d',
		backgroundBottom: '#060a10'
	},
	{
		id: 'lime',
		label: 'Lime',
		description: 'Acid green with late-night energy.',
		swatch: 'linear-gradient(135deg, #84cc16 0%, #2dd4bf 100%)',
		accent: '#a3e635',
		accentSoft: '#d9f99d',
		glowStrong: 'rgba(163, 230, 53, 0.22)',
		glowSoft: 'rgba(45, 212, 191, 0.16)',
		backgroundTop: '#10170a',
		backgroundBottom: '#070b08'
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
		`background: radial-gradient(circle at top left, ${theme.glowStrong}, transparent 32%), radial-gradient(circle at 80% 18%, ${theme.glowSoft}, transparent 24%), linear-gradient(180deg, ${theme.backgroundTop} 0%, ${theme.backgroundBottom} 100%)`
	].join('; ');
}

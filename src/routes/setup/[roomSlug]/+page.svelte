<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { readSetupPayload } from '$lib/browser/storage';
	import { DEFAULT_ROOM_COLOR, getRoomThemeStyle } from '$lib/room-colors';
	import { Copy, Download, KeyRound, Link2, QrCode } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	const roomSlug = $derived(page.params.roomSlug ?? '');

	let setupPayload = $state<{
		guestUrl: string;
		adminUrl: string;
		pin: string;
		color?: string;
	} | null>(null);
	let qrSvg = $state('');
	let qrPng = $state('');
	let copyState = $state('');
	let loadError = $state('');
	const roomThemeStyle = $derived(getRoomThemeStyle(setupPayload?.color ?? DEFAULT_ROOM_COLOR));

	async function copyToClipboard(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			copyState = `${label} copied`;
			setTimeout(() => {
				copyState = '';
			}, 1400);
		} catch {
			copyState = 'Clipboard unavailable';
		}
	}

	onMount(async () => {
		if (!roomSlug) {
			loadError = 'This room slug is missing.';
			return;
		}

		setupPayload = readSetupPayload(roomSlug);

		if (!setupPayload) {
			loadError =
				'Setup details are only stored on the device that created the room. Create a new room if you need a fresh admin link and PIN.';
			return;
		}

		qrSvg = await QRCode.toString(setupPayload.guestUrl, {
			type: 'svg',
			margin: 1,
			color: {
				dark: '#0a0908',
				light: '#f8f0e5'
			}
		});

		qrPng = await QRCode.toDataURL(setupPayload.guestUrl, {
			margin: 1,
			width: 1024,
			color: {
				dark: '#0a0908',
				light: '#f8f0e5'
			}
		});
	});
</script>

<svelte:head>
	<title>DJR | Room setup</title>
</svelte:head>

<div class="min-h-screen px-5 py-6 sm:px-8 lg:px-12" style={roomThemeStyle}>
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="eyebrow">Room ready</p>
				<h1 class="font-display text-4xl text-[var(--color-paper)]">Share the floor</h1>
				<p class="mt-2 max-w-xl text-sm leading-6 text-[var(--color-muted)]">
					Next: share the guest link or QR code, then keep the DJ board open where you can manage
					the queue.
				</p>
			</div>
			<a class="btn-secondary" href={`/dj/${roomSlug}`}>
				<KeyRound size={16} />
				Open DJ board
			</a>
		</header>

		{#if loadError}
			<section class="panel space-y-4">
				<p class="text-lg text-[var(--color-paper)]">No setup payload on this device</p>
				<p class="text-[var(--color-muted)]">{loadError}</p>
			</section>
		{:else if setupPayload}
			<div class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
				<section class="panel space-y-4">
					<div class="flex items-center gap-3">
						<div
							class="rounded-[1.35rem] border border-black/8 bg-[var(--color-paper)]/88 p-3 text-[var(--color-ink)]"
						>
							<QrCode size={22} />
						</div>
						<div>
							<p class="eyebrow text-[var(--color-accent-soft)]">Guest access</p>
							<h2 class="text-xl font-semibold text-[var(--color-paper)]">Print or share the QR</h2>
						</div>
					</div>

					<div
						class="rounded-[1.6rem] bg-[var(--color-paper)]/96 p-5 text-[var(--color-ink)] shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
					>
						{#if qrSvg}
							<div class="mx-auto aspect-square w-full max-w-sm">
								{@html qrSvg}
							</div>
						{/if}
					</div>

					<div class="flex flex-wrap gap-3">
						<button
							class="btn-primary"
							type="button"
							onclick={() => setupPayload && copyToClipboard(setupPayload.guestUrl, 'Guest URL')}
						>
							<Copy size={16} />
							Copy guest link
						</button>
						{#if browser && qrPng}
							<a class="btn-secondary" href={qrPng} download={`djr-${roomSlug}.png`}>
								<Download size={16} />
								Download PNG
							</a>
							<a
								class="btn-secondary"
								href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
								download={`djr-${roomSlug}.svg`}
							>
								<Download size={16} />
								Download SVG
							</a>
						{/if}
					</div>
				</section>

				<section class="space-y-6">
					<div class="panel space-y-4">
						<div class="flex items-center gap-3">
							<Link2 size={18} />
							<h2 class="text-xl font-semibold text-[var(--color-paper)]">Guest URL</h2>
						</div>
						<p
							class="rounded-[1.35rem] border border-white/8 bg-white/4 px-4 py-4 text-sm break-all text-[var(--color-paper)]"
						>
							{setupPayload.guestUrl}
						</p>
					</div>

					<div class="panel space-y-4">
						<div class="flex items-center gap-3">
							<KeyRound size={18} />
							<h2 class="text-xl font-semibold text-[var(--color-paper)]">Admin access</h2>
						</div>
						<div class="grid gap-4 md:grid-cols-[1fr_auto]">
							<div
								class="rounded-[1.35rem] border border-white/8 bg-white/4 px-4 py-4 text-sm text-[var(--color-paper)]"
							>
								<p class="mb-2 text-xs tracking-[0.2em] text-[var(--color-accent-soft)] uppercase">
									Private admin link
								</p>
								<p class="break-all">{setupPayload.adminUrl}</p>
							</div>
							<div
								class="rounded-[1.35rem] border border-[var(--color-accent)]/16 bg-[var(--color-accent)]/7 px-5 py-4 text-center text-[var(--color-paper)]"
							>
								<p class="mb-1 text-xs tracking-[0.2em] text-[var(--color-accent-soft)] uppercase">
									Fallback PIN
								</p>
								<p class="font-display text-4xl tracking-[0.12em]">{setupPayload.pin}</p>
							</div>
						</div>
						<div class="flex flex-wrap gap-3">
							<button
								class="btn-secondary"
								type="button"
								onclick={() => setupPayload && copyToClipboard(setupPayload.adminUrl, 'Admin URL')}
							>
								<Copy size={16} />
								Copy admin link
							</button>
							<button
								class="btn-secondary"
								type="button"
								onclick={() => setupPayload && copyToClipboard(setupPayload.pin, 'PIN')}
							>
								<Copy size={16} />
								Copy PIN
							</button>
						</div>
					</div>
				</section>
			</div>
		{/if}

		{#if copyState}
			<p class="text-sm text-[var(--color-muted)]">
				{copyState}
				{#if copyState !== 'Clipboard unavailable'}
					. You can paste it anywhere guests will see it.
				{/if}
			</p>
		{/if}
	</div>
</div>

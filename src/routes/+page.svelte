<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/convexApi';
	import { saveSetupPayload } from '$lib/browser/storage';
	import {
		DEFAULT_ROOM_COLOR,
		getRoomColorOption,
		getRoomThemeStyle,
		type RoomColorId,
		ROOM_COLOR_OPTIONS
	} from '$lib/room-colors';
	import { useConvexClient } from 'convex-svelte';
	import { LoaderCircle, RadioTower, ShieldCheck, Sparkles } from 'lucide-svelte';

	const PROVIDER_OPTIONS = [
		{
			id: 'soundcloud',
			label: 'SoundCloud',
			description: 'Let guests search your SoundCloud catalog.'
		},
		{
			id: 'spotify',
			label: 'Spotify',
			description: 'Let guests search your Spotify catalog.'
		}
	] as const;

	const client = useConvexClient();

	let djName = $state('');
	let eventName = $state('');
	let roomColor = $state<RoomColorId>(DEFAULT_ROOM_COLOR);
	let enabledProviders = $state<Array<(typeof PROVIDER_OPTIONS)[number]['id']>>([]);
	let soundcloudClientId = $state('');
	let soundcloudClientSecret = $state('');
	let spotifyClientId = $state('');
	let spotifyClientSecret = $state('');
	let errorMessage = $state('');
	let isSubmitting = $state(false);
	const pageThemeStyle = $derived(getRoomThemeStyle(roomColor));
	const canSubmit = $derived(
		Boolean(
			djName.trim() &&
			eventName.trim() &&
			enabledProviders.length > 0 &&
			(!enabledProviders.includes('soundcloud') ||
				(soundcloudClientId.trim() && soundcloudClientSecret.trim())) &&
			(!enabledProviders.includes('spotify') ||
				(spotifyClientId.trim() && spotifyClientSecret.trim()))
		)
	);

	async function handleCreateRoom(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isSubmitting = true;

		try {
			const payload = await client.mutation(api.rooms.createRoom, {
				djName: djName.trim(),
				eventName: eventName.trim(),
				color: roomColor,
				enabledProviders,
				soundcloudCredentials: enabledProviders.includes('soundcloud')
					? {
							clientId: soundcloudClientId.trim(),
							clientSecret: soundcloudClientSecret.trim()
						}
					: undefined,
				spotifyCredentials: enabledProviders.includes('spotify')
					? {
							clientId: spotifyClientId.trim(),
							clientSecret: spotifyClientSecret.trim()
						}
					: undefined,
				origin: window.location.origin
			});

			saveSetupPayload(payload.roomSlug, {
				guestUrl: payload.guestUrl,
				adminUrl: payload.adminUrl,
				pin: payload.pin,
				color: roomColor
			});

			await goto(`/setup/${payload.roomSlug}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to create room.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>DJR | Build a live request room</title>
</svelte:head>

<div class="min-h-screen" style={pageThemeStyle}>
	<div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-12">
		<header class="flex items-center justify-between">
			<div>
				<p class="eyebrow">DJ Request Room</p>
				<h1 class="text-2xl font-semibold tracking-[0.04em] text-[var(--color-paper)] sm:text-3xl">
					DJR
				</h1>
			</div>
			<div class="pill">
				<RadioTower size={16} />
				<span>Spotify and SoundCloud rooms</span>
			</div>
		</header>

		<main class="grid gap-8 py-2 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-14">
			<section class="space-y-6">
				<div class="space-y-4">
					<p class="eyebrow">For weddings, clubs, bars, private events</p>
					<h2
						class="font-display text-4xl leading-[0.96] text-[var(--color-paper)] sm:text-5xl lg:text-6xl"
					>
						One QR code.
						<br />
						An orderly crowd.
					</h2>
					<p class="max-w-xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
						Create a request room, print the guest QR code, and let the floor decide which tracks
						rise without exposing raw vote counts, using the music providers you enable for that
						room.
					</p>
				</div>

				<ul class="max-w-2xl divide-y divide-white/8 border-y border-white/8">
					<li class="flex gap-3 py-4">
						<RadioTower class="mt-1 shrink-0 text-[var(--color-accent-soft)]" size={18} />
						<div>
							<p class="text-sm font-medium text-[var(--color-paper)]">Realtime queue</p>
							<p class="mt-1 text-sm leading-6 text-[var(--color-muted)]">
								Guests add tracks and the DJ board updates instantly.
							</p>
						</div>
					</li>
					<li class="flex gap-3 py-4">
						<ShieldCheck class="mt-1 shrink-0 text-[var(--color-accent-soft)]" size={18} />
						<div>
							<p class="text-sm font-medium text-[var(--color-paper)]">Private DJ access</p>
							<p class="mt-1 text-sm leading-6 text-[var(--color-muted)]">
								Each room includes an admin link and a 6-digit backup PIN.
							</p>
						</div>
					</li>
					<li class="flex gap-3 py-4">
						<Sparkles class="mt-1 shrink-0 text-[var(--color-accent-soft)]" size={18} />
						<div>
							<p class="text-sm font-medium text-[var(--color-paper)]">Hidden vote totals</p>
							<p class="mt-1 text-sm leading-6 text-[var(--color-muted)]">
								The crowd can react without piling onto a visible score.
							</p>
						</div>
					</li>
				</ul>
			</section>

			<section class="panel">
				<div class="space-y-6">
					<div>
						<p class="eyebrow">Create room</p>
						<h2 class="font-display text-[2rem] text-[var(--color-paper)]">Spin up an event</h2>
						<p class="mt-2 max-w-md text-sm leading-6 text-[var(--color-muted)]">
							Start with the event details, then connect the music services you actually use.
							Appearance can wait until the room is ready.
						</p>
					</div>

					<form class="space-y-4" onsubmit={handleCreateRoom}>
						<p class="helper-note">Most rooms take about two minutes to set up.</p>

						<label class="field-shell">
							<span>DJ name</span>
							<input
								class="field"
								type="text"
								name="djName"
								bind:value={djName}
								placeholder="DJ Sol, Joakim, Booth B"
								required
							/>
						</label>

						<label class="field-shell">
							<span>Event name</span>
							<input
								class="field"
								type="text"
								name="eventName"
								bind:value={eventName}
								placeholder="Rooftop set, wedding dinner, afterparty"
								required
							/>
						</label>

						<fieldset class="field-shell">
							<legend>Music providers</legend>
							<p class="helper-note">
								Choose only the services you already have app credentials for.
							</p>
							<div class="grid gap-3 sm:grid-cols-2">
								{#each PROVIDER_OPTIONS as option}
									<label
										class:color-option-selected={enabledProviders.includes(option.id)}
										class="color-option"
									>
										<input
											class="sr-only"
											type="checkbox"
											name="enabledProviders"
											value={option.id}
											bind:group={enabledProviders}
										/>
										<span
											class="color-swatch flex items-center justify-center bg-[rgba(255,255,255,0.08)] text-xs font-semibold tracking-[0.18em] text-[var(--color-paper)]"
										>
											{#if option.id === 'soundcloud'}
												<img
													class="h-7 w-7 object-contain"
													src="/SoundCloud-dark.svg"
													alt=""
													aria-hidden="true"
												/>
											{:else}
												<img
													class="h-7 w-7 object-contain"
													src="/Spotify.svg"
													alt=""
													aria-hidden="true"
												/>
											{/if}
										</span>
										<span class="min-w-0">
											<span class="block text-sm font-semibold text-[var(--color-paper)]">
												{option.label}
											</span>
											<span class="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
												{option.description}
											</span>
										</span>
									</label>
								{/each}
							</div>
							{#if enabledProviders.length === 0}
								<p class="text-xs leading-5 text-red-100">
									Pick at least one service to keep going.
								</p>
							{/if}
						</fieldset>

						{#if enabledProviders.includes('soundcloud')}
							<fieldset class="field-shell">
								<legend>SoundCloud credentials</legend>
								<div class="grid gap-4 md:grid-cols-2">
									<label class="field-shell">
										<span>Client ID</span>
										<input
											class="field"
											type="text"
											name="soundcloudClientId"
											bind:value={soundcloudClientId}
											placeholder="SoundCloud client ID"
											required={enabledProviders.includes('soundcloud')}
										/>
									</label>
									<label class="field-shell">
										<span>Client secret</span>
										<input
											class="field"
											type="password"
											name="soundcloudClientSecret"
											bind:value={soundcloudClientSecret}
											placeholder="SoundCloud client secret"
											required={enabledProviders.includes('soundcloud')}
										/>
									</label>
								</div>
								<p class="helper-note">Used only to search tracks for guests in this room.</p>
							</fieldset>
						{/if}

						{#if enabledProviders.includes('spotify')}
							<fieldset class="field-shell">
								<legend>Spotify credentials</legend>
								<div class="grid gap-4 md:grid-cols-2">
									<label class="field-shell">
										<span>Client ID</span>
										<input
											class="field"
											type="text"
											name="spotifyClientId"
											bind:value={spotifyClientId}
											placeholder="Spotify client ID"
											required={enabledProviders.includes('spotify')}
										/>
									</label>
									<label class="field-shell">
										<span>Client secret</span>
										<input
											class="field"
											type="password"
											name="spotifyClientSecret"
											bind:value={spotifyClientSecret}
											placeholder="Spotify client secret"
											required={enabledProviders.includes('spotify')}
										/>
									</label>
								</div>
								<p class="helper-note">Used only to search tracks for guests in this room.</p>
							</fieldset>
						{/if}

						<details class="details-panel">
							<summary>
								<div>
									<p class="text-sm font-medium text-[var(--color-paper)]">Room appearance</p>
									<p class="mt-1 text-sm leading-6 text-[var(--color-muted)]">
										Default is {getRoomColorOption(DEFAULT_ROOM_COLOR).label}. Open this only if you
										want a different room theme.
									</p>
								</div>
								<span class="text-xs tracking-[0.18em] text-[var(--color-accent-soft)] uppercase">
									Optional
								</span>
							</summary>

							<div class="mt-4 space-y-3">
								<div class="grid gap-3 sm:grid-cols-2">
									{#each ROOM_COLOR_OPTIONS as option}
										<label
											class:color-option-selected={roomColor === option.id}
											class="color-option"
										>
											<input
												class="sr-only"
												type="radio"
												name="roomColor"
												value={option.id}
												bind:group={roomColor}
											/>
											<span class="color-swatch" style={`background: ${option.swatch}`}></span>
											<span class="min-w-0">
												<span class="block text-sm font-semibold text-[var(--color-paper)]">
													{option.label}
													{#if option.id === DEFAULT_ROOM_COLOR}
														<span class="ml-1 text-xs text-[var(--color-accent-soft)]">
															Default
														</span>
													{/if}
												</span>
												<span class="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
													{option.description}
												</span>
											</span>
										</label>
									{/each}
								</div>
								<p class="text-xs leading-5 text-[var(--color-muted)]">
									Selected theme:
									<span class="font-semibold text-[var(--color-paper)]">
										{getRoomColorOption(roomColor).label}
									</span>
								</p>
							</div>
						</details>

						{#if errorMessage}
							<p
								class="rounded-[1.35rem] border border-red-300/18 bg-red-400/8 px-4 py-3 text-sm text-red-100/92"
							>
								{errorMessage}
							</p>
						{/if}

						<button
							class="btn-primary w-full justify-center"
							type="submit"
							disabled={isSubmitting || !canSubmit}
						>
							{#if isSubmitting}
								<LoaderCircle class="animate-spin" size={18} />
							{/if}
							<span>{isSubmitting ? 'Creating room...' : 'Create DJ room'}</span>
						</button>
					</form>

					<div class="border-t border-white/8 pt-4 text-sm text-[var(--color-muted)]">
						Create a room and get a guest page, DJ board, QR code, private admin link, and backup
						PIN.
					</div>
				</div>
			</section>
		</main>
	</div>
</div>

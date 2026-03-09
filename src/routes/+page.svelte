<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/convexApi';
	import { saveSetupPayload } from '$lib/browser/storage';
	import { useConvexClient } from 'convex-svelte';
	import { LoaderCircle, RadioTower, ShieldCheck, Sparkles } from 'lucide-svelte';

	const client = useConvexClient();

	let djName = $state('');
	let eventName = $state('');
	let errorMessage = $state('');
	let isSubmitting = $state(false);

	async function handleCreateRoom(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isSubmitting = true;

		try {
			const payload = await client.mutation(api.rooms.createRoom, {
				djName: djName.trim(),
				eventName: eventName.trim(),
				origin: window.location.origin
			});

			saveSetupPayload(payload.roomSlug, {
				guestUrl: payload.guestUrl,
				adminUrl: payload.adminUrl,
				pin: payload.pin
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

<div
	class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,120,74,0.28),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(255,216,184,0.2),_transparent_25%),linear-gradient(180deg,_#140f0b_0%,_#090909_100%)]"
>
	<div
		class="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-12"
	>
		<header class="flex items-center justify-between">
			<div>
				<p class="eyebrow">DJ Request Room</p>
				<h1 class="text-2xl font-semibold tracking-[0.04em] text-[var(--color-paper)] sm:text-3xl">
					DJR
				</h1>
			</div>
			<div class="pill">
				<Sparkles size={16} />
				<span>SoundCloud + Spotify queue</span>
			</div>
		</header>

		<main class="grid gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
			<section class="space-y-6">
				<div class="space-y-4">
					<p class="eyebrow">For weddings, clubs, bars, private events</p>
					<h2
						class="font-display text-5xl leading-[0.9] text-[var(--color-paper)] sm:text-6xl lg:text-7xl"
					>
						One QR code.
						<br />
						An orderly crowd.
					</h2>
					<p class="max-w-xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
						Create a request room, print the guest QR code, and let the floor decide which
						SoundCloud and Spotify tracks rise without exposing raw vote counts.
					</p>
				</div>

				<div class="grid gap-4 sm:grid-cols-3">
					<article class="feature-card">
						<RadioTower size={20} />
						<h3>Realtime queue</h3>
						<p>Guests vote live. The DJ board updates instantly without refreshes.</p>
					</article>
					<article class="feature-card">
						<ShieldCheck size={20} />
						<h3>Private DJ access</h3>
						<p>Each room ships with a one-time admin link and backup PIN.</p>
					</article>
					<article class="feature-card">
						<Sparkles size={20} />
						<h3>No popularity pile-on</h3>
						<p>Guests can react, but the numbers stay hidden from the crowd.</p>
					</article>
				</div>
			</section>

			<section class="panel relative overflow-hidden">
				<div
					class="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-70"
				></div>
				<div class="space-y-6">
					<div>
						<p class="eyebrow">Create room</p>
						<h2 class="font-display text-3xl text-[var(--color-paper)]">Spin up an event</h2>
					</div>

					<form class="space-y-4" onsubmit={handleCreateRoom}>
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

						{#if errorMessage}
							<p
								class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
							>
								{errorMessage}
							</p>
						{/if}

						<button
							class="btn-primary w-full justify-center"
							type="submit"
							disabled={isSubmitting || !djName.trim() || !eventName.trim()}
						>
							{#if isSubmitting}
								<LoaderCircle class="animate-spin" size={18} />
							{/if}
							<span>{isSubmitting ? 'Creating room...' : 'Create DJ room'}</span>
						</button>
					</form>

					<div
						class="rounded-[1.75rem] border border-white/10 bg-white/4 p-5 text-sm text-[var(--color-muted)]"
					>
						<p class="mb-3 text-xs tracking-[0.28em] text-[var(--color-accent-soft)] uppercase">
							What you get
						</p>
						<ul class="space-y-2">
							<li>Guest request page with song search and hidden vote totals</li>
							<li>DJ control board with live score, queue order, and “mark played”</li>
							<li>Shareable QR code, private admin link, and a 6-digit fallback PIN</li>
						</ul>
					</div>
				</div>
			</section>
		</main>
	</div>
</div>

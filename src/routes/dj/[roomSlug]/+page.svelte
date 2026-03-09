<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Id } from '$lib/convexModel';
	import { api } from '$lib/convexApi';
	import type { PageData } from './$types';
	import { clearAdminSession, readAdminSession, saveAdminSession } from '$lib/browser/storage';
	import { formatDuration, formatRelativeDate, formatSourceLabel } from '$lib/format';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { CheckCheck, LoaderCircle, LogOut, ShieldEllipsis } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
	const initialAdminToken = $derived(data.initialAdminToken);
	const initialError = $derived(data.initialError ?? '');
	const roomSlug = $derived(data.roomSlug);

	const client = useConvexClient();

	let adminToken = $state<string | null>(null);
	let pin = $state('');
	let authError = $state('');
	let authBusy = $state(false);
	let actionBusyId = $state<string | null>(null);

	const roomQuery = useQuery(
		api.rooms.getAdminRoom,
		() =>
			adminToken
				? {
						slug: roomSlug,
						adminSessionToken: adminToken
					}
				: 'skip',
		() => ({
			initialData: data.initialRoom ?? undefined,
			keepPreviousData: true
		})
	);

	$effect(() => {
		if (adminToken === null && initialAdminToken) {
			adminToken = initialAdminToken;
		}

		if (!authError && initialError) {
			authError = initialError;
		}
	});

	onMount(async () => {
		if (!adminToken) {
			adminToken = readAdminSession(roomSlug);
		}

		if (data.incomingToken && !adminToken) {
			authBusy = true;
			authError = '';

			try {
				const result = await client.mutation(api.admin.exchangeLinkToken, {
					slug: roomSlug,
					token: data.incomingToken
				});

				adminToken = result.sessionToken;
				saveAdminSession(roomSlug, result.sessionToken);
				await goto(`/dj/${roomSlug}`, { replaceState: true, noScroll: true });
			} catch (error) {
				authError = error instanceof Error ? error.message : 'Unable to open DJ room.';
			} finally {
				authBusy = false;
			}
		}
	});

	async function loginWithPin(event: SubmitEvent) {
		event.preventDefault();
		authBusy = true;
		authError = '';

		try {
			const result = await client.mutation(api.admin.loginWithPin, {
				slug: roomSlug,
				pin: pin.trim()
			});

			adminToken = result.sessionToken;
			saveAdminSession(roomSlug, result.sessionToken);
			pin = '';
		} catch (error) {
			authError = error instanceof Error ? error.message : 'Unable to sign in.';
		} finally {
			authBusy = false;
		}
	}

	async function markPlayed(requestId: Id<'requests'>) {
		if (!adminToken) {
			return;
		}

		actionBusyId = requestId;
		authError = '';

		try {
			await client.mutation(api.requests.markPlayed, {
				requestId,
				adminSessionToken: adminToken
			});
		} catch (error) {
			authError = error instanceof Error ? error.message : 'Unable to mark track as played.';
		} finally {
			actionBusyId = null;
		}
	}

	async function logout() {
		if (adminToken) {
			try {
				await client.mutation(api.admin.logout, {
					adminSessionToken: adminToken
				});
			} catch {}
		}

		clearAdminSession(roomSlug);
		adminToken = null;
	}
</script>

<svelte:head>
	<title>DJR | DJ board</title>
</svelte:head>

<div
	class="min-h-screen bg-[linear-gradient(180deg,_#120d0b_0%,_#0a0908_100%)] px-4 py-5 sm:px-6 lg:px-8"
>
	<div class="mx-auto max-w-6xl space-y-6">
		<header class="panel flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="eyebrow">DJ board</p>
				<h1 class="font-display text-4xl text-[var(--color-paper)]">
					{roomQuery.data?.room.eventName ?? 'Control room'}
				</h1>
				<p class="text-[var(--color-muted)]">
					{roomQuery.data
						? `Managing requests for ${roomQuery.data.room.djName}`
						: 'Private access required'}
				</p>
			</div>
			{#if adminToken}
				<button class="btn-secondary" type="button" onclick={logout}>
					<LogOut size={16} />
					Log out
				</button>
			{/if}
		</header>

		{#if !adminToken}
			<section class="panel mx-auto max-w-xl space-y-5">
				<div class="space-y-2">
					<p class="eyebrow">Private access</p>
					<h2 class="text-2xl font-semibold text-[var(--color-paper)]">Enter your DJ PIN</h2>
				</div>

				<form class="space-y-4" onsubmit={loginWithPin}>
					<label class="field-shell">
						<span>6-digit PIN</span>
						<input
							class="field"
							type="password"
							inputmode="numeric"
							maxlength="6"
							bind:value={pin}
							placeholder="123456"
							required
						/>
					</label>

					{#if authError}
						<p
							class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
						>
							{authError}
						</p>
					{/if}

					<button
						class="btn-primary w-full justify-center"
						type="submit"
						disabled={authBusy || pin.trim().length !== 6}
					>
						{#if authBusy}
							<LoaderCircle class="animate-spin" size={18} />
						{:else}
							<ShieldEllipsis size={18} />
						{/if}
						<span>{authBusy ? 'Checking access...' : 'Unlock DJ board'}</span>
					</button>
				</form>
			</section>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
				<section class="panel space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="eyebrow">Active queue</p>
							<h2 class="text-2xl font-semibold text-[var(--color-paper)]">Vote-ranked requests</h2>
						</div>
						{#if roomQuery.isLoading}
							<LoaderCircle class="animate-spin text-[var(--color-muted)]" size={18} />
						{/if}
					</div>

					{#if authError}
						<p
							class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
						>
							{authError}
						</p>
					{/if}

					{#if roomQuery.data?.activeRequests.length}
						<div class="space-y-3">
							{#each roomQuery.data.activeRequests as request}
								<article class="queue-card">
									<div class="flex gap-4">
										<img
											class="h-16 w-16 rounded-2xl object-cover"
											src={request.artworkUrl ??
												'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80'}
											alt=""
										/>
										<div class="min-w-0 flex-1">
											<div
												class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
											>
												<div class="min-w-0">
													<h3 class="truncate text-lg font-semibold text-[var(--color-paper)]">
														{request.title}
													</h3>
													<p class="truncate text-sm text-[var(--color-muted)]">
														{request.artistName}
													</p>
													<p
														class="mt-1 text-[10px] tracking-[0.18em] text-[var(--color-accent-soft)] uppercase"
													>
														{formatSourceLabel(request.source)}
													</p>
													<p
														class="mt-2 text-xs tracking-[0.18em] text-[var(--color-accent-soft)] uppercase"
													>
														Requested {formatRelativeDate(request.createdAt)}
													</p>
												</div>
												<div class="flex flex-col items-start gap-2 sm:items-end">
													<div class="pill text-sm">
														<span
															>Score {request.score >= 0
																? `+${request.score}`
																: request.score}</span
														>
													</div>
													<p class="text-xs tracking-[0.2em] text-[var(--color-muted)] uppercase">
														{request.totalVotes} votes · {formatDuration(request.durationMs)}
													</p>
												</div>
											</div>

											<div class="mt-4 flex flex-wrap gap-2">
												<button
													class="btn-primary"
													type="button"
													disabled={actionBusyId === request.id}
													onclick={() => markPlayed(request.id)}
												>
													{#if actionBusyId === request.id}
														<LoaderCircle class="animate-spin" size={16} />
													{:else}
														<CheckCheck size={16} />
													{/if}
													Mark played
												</button>
												<a
													class="btn-ghost"
													href={request.permalinkUrl}
													target="_blank"
													rel="noreferrer"
												>
													Open on {formatSourceLabel(request.source)}
												</a>
											</div>
										</div>
									</div>
								</article>
							{/each}
						</div>
					{:else}
						<div
							class="rounded-[1.75rem] border border-dashed border-white/10 px-5 py-8 text-center text-sm text-[var(--color-muted)]"
						>
							Nothing in the queue yet.
						</div>
					{/if}
				</section>

				<section class="panel space-y-4">
					<div>
						<p class="eyebrow">Archive</p>
						<h2 class="text-2xl font-semibold text-[var(--color-paper)]">Played tracks</h2>
					</div>

					{#if roomQuery.data?.playedRequests.length}
						<div class="space-y-3">
							{#each roomQuery.data.playedRequests as request}
								<div class="rounded-[1.5rem] border border-white/8 bg-white/4 px-4 py-4">
									<div class="flex items-center justify-between gap-4">
										<div class="min-w-0">
											<p class="truncate font-medium text-[var(--color-paper)]">{request.title}</p>
											<p class="truncate text-sm text-[var(--color-muted)]">{request.artistName}</p>
											<p
												class="mt-1 text-[10px] tracking-[0.18em] text-[var(--color-accent-soft)] uppercase"
											>
												{formatSourceLabel(request.source)}
											</p>
										</div>
										<div class="text-right">
											<p class="text-sm font-semibold text-[var(--color-paper)]">
												{request.score >= 0 ? `+${request.score}` : request.score}
											</p>
											<p class="text-xs tracking-[0.2em] text-[var(--color-muted)] uppercase">
												{formatRelativeDate(request.playedAt)}
											</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-[var(--color-muted)]">Played requests will collect here.</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>

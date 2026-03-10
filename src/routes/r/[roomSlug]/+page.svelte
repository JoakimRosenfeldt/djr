<script lang="ts">
	import { onMount } from 'svelte';
	import type { Id } from '$lib/convexModel';
	import { api } from '$lib/convexApi';
	import type { PageData } from './$types';
	import { ensureGuestId } from '$lib/browser/storage';
	import { formatDuration, formatSourceLabel, truncateText } from '$lib/format';
	import { DEFAULT_ROOM_COLOR, getRoomThemeStyle } from '$lib/room-colors';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import {
		ArrowBigDownDash,
		ArrowBigUpDash,
		LoaderCircle,
		Search,
		TimerReset
	} from 'lucide-svelte';

	let { data }: { data: PageData } = $props();
	const initialGuestId = $derived(data.initialGuestId);
	const roomSlug = $derived(data.roomSlug);

	const client = useConvexClient();

	let guestId = $state<string | null>(null);
	let searchTerm = $state('');
	let searchResults = $state<
		Array<{
			source: 'soundcloud' | 'spotify';
			sourceTrackId: string;
			sourceTrackKey: string;
			title: string;
			artistName: string;
			artworkUrl: string | null;
			durationMs: number;
			permalinkUrl: string;
			alreadyQueued: boolean;
			alreadyPlayed: boolean;
		}>
	>([]);
	let isSearching = $state(false);
	let searchError = $state('');
	let latestSearchId = 0;
	let debounceHandle: ReturnType<typeof setTimeout> | null = null;
	let actionError = $state('');

	function syncSearchResultState() {
		if (!roomQuery.data || searchResults.length === 0) {
			return;
		}

		const activeTrackKeys = new Set(
			roomQuery.data.activeRequests.map((request) => request.sourceTrackKey)
		);
		const playedTrackKeys = new Set(
			roomQuery.data.playedRequests.map((request) => request.sourceTrackKey)
		);
		let hasChanges = false;
		const nextResults = searchResults.map((result) => {
			const alreadyQueued = activeTrackKeys.has(result.sourceTrackKey);
			const alreadyPlayed = playedTrackKeys.has(result.sourceTrackKey);

			if (result.alreadyQueued !== alreadyQueued || result.alreadyPlayed !== alreadyPlayed) {
				hasChanges = true;
				return {
					...result,
					alreadyQueued,
					alreadyPlayed
				};
			}

			return result;
		});

		if (hasChanges) {
			searchResults = nextResults;
		}
	}

	const roomQuery = useQuery(
		api.rooms.getPublicRoom,
		() => ({
			slug: roomSlug,
			guestId: guestId ?? undefined
		}),
		() => ({
			initialData: data.initialRoom ?? undefined,
			keepPreviousData: true
		})
	);
	const roomThemeStyle = $derived(
		getRoomThemeStyle(
			roomQuery.data?.room.color ?? data.initialRoom?.room.color ?? DEFAULT_ROOM_COLOR
		)
	);

	$effect(() => {
		if (guestId === null && initialGuestId) {
			guestId = initialGuestId;
		}
	});

	$effect(() => {
		roomQuery.data;
		searchResults.length;
		syncSearchResultState();
	});

	onMount(() => {
		guestId = ensureGuestId(initialGuestId ?? undefined);
	});

	$effect(() => {
		const currentQuery = searchTerm.trim();

		if (debounceHandle) {
			clearTimeout(debounceHandle);
		}

		if (currentQuery.length < 2) {
			searchResults = [];
			searchError = '';
			isSearching = false;
			return;
		}

		debounceHandle = setTimeout(async () => {
			const requestId = ++latestSearchId;
			isSearching = true;
			searchError = '';

			try {
				const results = await client.action(api.catalog.searchTracks, {
					roomSlug,
					query: currentQuery
				});

				if (requestId === latestSearchId) {
					searchResults = results;
				}
			} catch (error) {
				if (requestId === latestSearchId) {
					searchError = error instanceof Error ? error.message : 'Search is unavailable right now.';
				}
			} finally {
				if (requestId === latestSearchId) {
					isSearching = false;
				}
			}
		}, 200);

		return () => {
			if (debounceHandle) {
				clearTimeout(debounceHandle);
			}
		};
	});

	function jumpToRequest(requestId: Id<'requests'>) {
		document.getElementById(requestId)?.scrollIntoView({
			behavior: 'smooth',
			block: 'center'
		});
	}

	function formatSearchResultTitle(title: string) {
		return truncateText(title, 42);
	}

	async function addTrack(track: (typeof searchResults)[number]) {
		actionError = '';
		const resolvedGuestId = ensureGuestId(guestId ?? undefined);

		if (!resolvedGuestId) {
			actionError = 'Unable to identify this device for voting.';
			return;
		}

		guestId = resolvedGuestId;

		if (track.alreadyPlayed) {
			return;
		}

		if (track.alreadyQueued) {
			const activeRequest = roomQuery.data?.activeRequests.find(
				(request: (typeof roomQuery.data.activeRequests)[number]) =>
					request.sourceTrackKey === track.sourceTrackKey
			);

			if (activeRequest) {
				jumpToRequest(activeRequest.id);
			}
			return;
		}

		try {
			const result = await client.mutation(api.requests.addOrVote, {
				roomSlug,
				guestId: resolvedGuestId,
				track: {
					source: track.source,
					sourceTrackId: track.sourceTrackId,
					sourceTrackKey: track.sourceTrackKey,
					title: track.title,
					artistName: track.artistName,
					artworkUrl: track.artworkUrl,
					durationMs: track.durationMs,
					permalinkUrl: track.permalinkUrl
				}
			});

			searchResults = searchResults.map((entry) =>
				entry.sourceTrackKey === track.sourceTrackKey ? { ...entry, alreadyQueued: true } : entry
			);

			jumpToRequest(result.requestId);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Unable to add that track.';
		}
	}

	async function setVote(requestId: Id<'requests'>, currentVote: number, nextVote: -1 | 1) {
		actionError = '';
		const resolvedGuestId = ensureGuestId(guestId ?? undefined);

		if (!resolvedGuestId) {
			actionError = 'Unable to identify this device for voting.';
			return;
		}

		guestId = resolvedGuestId;

		try {
			await client.mutation(api.votes.setVote, {
				requestId,
				guestId: resolvedGuestId,
				value: currentVote === nextVote ? 0 : nextVote
			});
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Unable to update your vote.';
		}
	}
</script>

<svelte:head>
	<title>DJR | {data.initialRoom?.room.eventName ?? roomSlug}</title>
</svelte:head>

<div class="min-h-screen px-4 py-5 sm:px-6 lg:px-8" style={roomThemeStyle}>
	<div class="mx-auto max-w-6xl space-y-6">
		{#if data.initialError && !roomQuery.data}
			<section class="panel text-[var(--color-paper)]">{data.initialError}</section>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<section class="panel space-y-5">
					<div class="space-y-2">
						<p class="eyebrow">Search SoundCloud + Spotify</p>
						<label class="field-shell">
							<span>Track or artist</span>
							<div class="relative">
								<Search
									class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--color-muted)]"
									size={18}
								/>
								<input
									class="field pl-12"
									type="search"
									bind:value={searchTerm}
									placeholder="Search for a track..."
								/>
							</div>
						</label>
						<p class="text-sm text-[var(--color-muted)]">
							New requests start with your upvote. Tracks from both providers can be requested, and
							played tracks stay locked.
						</p>
					</div>

					{#if searchError}
						<p
							class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
						>
							{searchError}
						</p>
					{/if}
					{#if actionError}
						<p
							class="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
						>
							{actionError}
						</p>
					{/if}

					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<p class="eyebrow text-[var(--color-accent-soft)]">Results</p>
							{#if isSearching}
								<div class="flex items-center gap-2 text-sm text-[var(--color-muted)]">
									<LoaderCircle class="animate-spin" size={16} />
									Searching
								</div>
							{/if}
						</div>

						{#if searchResults.length === 0 && searchTerm.trim().length < 2}
							<div
								class="rounded-[1.75rem] border border-dashed border-white/10 px-5 py-8 text-center text-sm text-[var(--color-muted)]"
							>
								Type at least two characters to search.
							</div>
						{:else if searchResults.length === 0 && !isSearching}
							<div
								class="rounded-[1.75rem] border border-dashed border-white/10 px-5 py-8 text-center text-sm text-[var(--color-muted)]"
							>
								No tracks matched that search.
							</div>
						{:else}
							<div class="space-y-3">
								{#each searchResults as result}
									{@const activeRequest = roomQuery.data?.activeRequests.find(
										(request) => request.sourceTrackKey === result.sourceTrackKey
									)}
									<article class="queue-card p-3">
										<div class="flex items-start gap-3 text-left">
											<img
												class="h-12 w-12 rounded-xl object-cover sm:h-14 sm:w-14"
												src={result.artworkUrl ??
													'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80'}
												alt=""
											/>
											<div class="min-w-0 flex-1">
												<div class="min-w-0">
													<h3
														class="block max-w-full overflow-hidden text-[15px] font-semibold text-ellipsis whitespace-nowrap text-[var(--color-paper)]"
														title={result.title}
													>
														{formatSearchResultTitle(result.title)}
													</h3>
													<p class="truncate text-sm leading-tight text-[var(--color-muted)]">
														{result.artistName}
													</p>
												</div>
												<div class="mt-2 flex flex-wrap items-center gap-1.5">
													<span class="pill px-3 py-1 text-[11px]">
														{formatDuration(result.durationMs)}
													</span>
													<span class="pill px-3 py-1 text-[10px] tracking-[0.18em] uppercase">
														{formatSourceLabel(result.source)}
													</span>
													{#if result.alreadyPlayed}
														<span
															class="pill border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] tracking-[0.18em] text-amber-100 uppercase"
														>
															Played
														</span>
													{:else if result.alreadyQueued}
														<span
															class="pill border-white/15 bg-white/8 px-3 py-1 text-[10px] tracking-[0.18em] text-[var(--color-paper)] uppercase"
														>
															In queue
														</span>
													{/if}
												</div>
												{#if activeRequest}
													<div
														class="hidden sm:mt-2 sm:grid sm:w-full sm:min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-1.5"
													>
														<button
															class={activeRequest.viewerVote === 1
																? 'vote-button vote-button-active min-w-0 justify-center'
																: 'vote-button min-w-0 justify-center'}
															type="button"
															onclick={() => setVote(activeRequest.id, activeRequest.viewerVote, 1)}
														>
															<ArrowBigUpDash size={18} />
															<span class="truncate">Upvote</span>
														</button>
														<button
															class={activeRequest.viewerVote === -1
																? 'vote-button vote-button-active min-w-0 justify-center'
																: 'vote-button min-w-0 justify-center'}
															type="button"
															onclick={() =>
																setVote(activeRequest.id, activeRequest.viewerVote, -1)}
														>
															<ArrowBigDownDash size={18} />
															<span class="truncate">Downvote</span>
														</button>
														<button
															class="btn-secondary w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
															type="button"
															onclick={() => jumpToRequest(activeRequest.id)}
														>
															<span class="truncate">Show</span>
														</button>
														<a
															class="btn-ghost w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
															href={result.permalinkUrl}
															target="_blank"
															rel="noreferrer"
														>
															<span class="truncate">Open</span>
														</a>
													</div>
												{:else}
													<div
														class="hidden sm:mt-2 sm:grid sm:w-full sm:min-w-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-1.5"
													>
														<button
															class={result.alreadyPlayed
																? 'btn-secondary min-w-0 opacity-60'
																: 'btn-primary w-full min-w-0 justify-center'}
															type="button"
															disabled={result.alreadyPlayed}
															onclick={() => addTrack(result)}
														>
															{#if result.alreadyPlayed}
																<span class="truncate">Played already</span>
															{:else}
																<span class="truncate">Request track</span>
															{/if}
														</button>
														<a
															class="btn-ghost w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
															href={result.permalinkUrl}
															target="_blank"
															rel="noreferrer"
														>
															<span class="truncate">Open</span>
														</a>
													</div>
												{/if}
											</div>
										</div>
										{#if activeRequest}
											<div
												class="mt-2 grid w-full min-w-0 grid-cols-2 items-center gap-1.5 sm:hidden"
											>
												<button
													class={activeRequest.viewerVote === 1
														? 'vote-button vote-button-active min-w-0 justify-center'
														: 'vote-button min-w-0 justify-center'}
													type="button"
													onclick={() => setVote(activeRequest.id, activeRequest.viewerVote, 1)}
												>
													<ArrowBigUpDash size={18} />
													<span class="truncate">Upvote</span>
												</button>
												<button
													class={activeRequest.viewerVote === -1
														? 'vote-button vote-button-active min-w-0 justify-center'
														: 'vote-button min-w-0 justify-center'}
													type="button"
													onclick={() => setVote(activeRequest.id, activeRequest.viewerVote, -1)}
												>
													<ArrowBigDownDash size={18} />
													<span class="truncate">Downvote</span>
												</button>
												<button
													class="btn-secondary w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
													type="button"
													onclick={() => jumpToRequest(activeRequest.id)}
												>
													<span class="truncate">Show</span>
												</button>
												<a
													class="btn-ghost w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
													href={result.permalinkUrl}
													target="_blank"
													rel="noreferrer"
												>
													<span class="truncate">Open</span>
												</a>
											</div>
										{:else}
											<div
												class="mt-2 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:hidden"
											>
												<button
													class={result.alreadyPlayed
														? 'btn-secondary min-w-0 opacity-60'
														: 'btn-primary w-full min-w-0 justify-center'}
													type="button"
													disabled={result.alreadyPlayed}
													onclick={() => addTrack(result)}
												>
													{#if result.alreadyPlayed}
														<span class="truncate">Played already</span>
													{:else}
														<span class="truncate">Request track</span>
													{/if}
												</button>
												<a
													class="btn-ghost w-full min-w-0 justify-center px-4 py-2 whitespace-nowrap"
													href={result.permalinkUrl}
													target="_blank"
													rel="noreferrer"
												>
													<span class="truncate">Open</span>
												</a>
											</div>
										{/if}
									</article>
								{/each}
							</div>
						{/if}
					</div>
				</section>

				<section class="space-y-6">
					<section class="panel space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="eyebrow">Current queue</p>
								<h2 class="text-xl font-semibold text-[var(--color-paper)]">Requested now</h2>
							</div>
							{#if roomQuery.isLoading}
								<LoaderCircle class="animate-spin text-[var(--color-muted)]" size={18} />
							{/if}
						</div>

						{#if roomQuery.data?.activeRequests.length}
							<div class="space-y-3">
								{#each roomQuery.data.activeRequests as request}
									<article class="queue-card p-3 sm:p-4" id={request.id}>
										<div class="flex items-start gap-3 text-left sm:gap-4">
											<img
												class="h-14 w-14 rounded-2xl object-cover sm:h-16 sm:w-16"
												src={request.artworkUrl ??
													'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80'}
												alt=""
											/>
											<div class="min-w-0 flex-1">
												<div class="flex items-start justify-between gap-3">
													<div class="min-w-0">
														<h3 class="truncate text-base font-semibold text-[var(--color-paper)]">
															{request.title}
														</h3>
														<p class="truncate text-sm text-[var(--color-muted)]">
															{request.artistName}
														</p>
													</div>
													<div class="flex flex-col items-end gap-2">
														<span class="pill text-xs">{formatDuration(request.durationMs)}</span>
														<span class="pill text-[10px] tracking-[0.18em] uppercase">
															{formatSourceLabel(request.source)}
														</span>
													</div>
												</div>
												<div
													class="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
												>
													<button
														class={request.viewerVote === 1
															? 'vote-button vote-button-active justify-center'
															: 'vote-button justify-center'}
														type="button"
														onclick={() => setVote(request.id, request.viewerVote, 1)}
													>
														<ArrowBigUpDash size={18} />
														<span>Upvote</span>
													</button>
													<button
														class={request.viewerVote === -1
															? 'vote-button vote-button-active justify-center'
															: 'vote-button justify-center'}
														type="button"
														onclick={() => setVote(request.id, request.viewerVote, -1)}
													>
														<ArrowBigDownDash size={18} />
														<span>Downvote</span>
													</button>
													<a
														class="btn-ghost justify-self-end whitespace-nowrap"
														href={request.permalinkUrl}
														target="_blank"
														rel="noreferrer"
													>
														Open
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
								No requests yet. Search for the first track.
							</div>
						{/if}
					</section>

					<section class="panel space-y-4">
						<div>
							<p class="eyebrow">Played</p>
							<h2 class="text-xl font-semibold text-[var(--color-paper)]">Already dropped</h2>
						</div>

						{#if roomQuery.data?.playedRequests.length}
							<div class="space-y-3">
								{#each roomQuery.data.playedRequests as request}
									<div
										class="flex items-center justify-between rounded-[1.5rem] border border-white/8 bg-white/4 px-4 py-4"
									>
										<div class="min-w-0">
											<p class="truncate font-medium text-[var(--color-paper)]">{request.title}</p>
											<p class="truncate text-sm text-[var(--color-muted)]">{request.artistName}</p>
											<p
												class="mt-1 text-[10px] tracking-[0.18em] text-[var(--color-accent-soft)] uppercase"
											>
												{formatSourceLabel(request.source)}
											</p>
										</div>
										<div
											class="flex items-center gap-2 text-xs tracking-[0.2em] text-[var(--color-accent-soft)] uppercase"
										>
											<TimerReset size={14} />
											<span>Locked</span>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-[var(--color-muted)]">
								Nothing has been marked as played yet.
							</p>
						{/if}
					</section>
				</section>
			</div>
		{/if}
	</div>
</div>

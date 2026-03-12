# DJR

DJR is a live DJ request room for parties, weddings, clubs, and private events.

Create a room, share a guest QR code, let guests search tracks from Spotify and/or SoundCloud, and manage the queue from a private DJ board. Guests can vote requests up or down, but raw vote counts stay hidden from the crowd.

## What it does

- Creates event-specific request rooms with a custom theme color
- Generates a guest URL and QR code for sharing on-site
- Generates a private DJ admin link plus a fallback 6-digit PIN
- Lets guests search enabled music providers and add songs to the room
- Lets guests upvote or downvote active requests from the same device
- Gives DJs a live board to review the queue, mark tracks as played, clear the played archive, or reset the room

## Product flow

1. Open `/` and create a room with a DJ name, event name, and one or more music providers.
2. Share the guest link or print the QR code from `/setup/[roomSlug]`.
3. Guests join `/r/[roomSlug]`, search tracks, and vote on requests.
4. The DJ manages the room from `/dj/[roomSlug]` using the one-time admin link or PIN.

## Stack

- SvelteKit 2
- Svelte 5
- Tailwind CSS 4
- Convex for backend, realtime state, and actions
- `convex-svelte` for client bindings
- `qrcode` for setup-page QR generation

## Local development

### Prerequisites

- Bun or npm
- A Convex project

### Environment

This app requires `PUBLIC_CONVEX_URL` for the SvelteKit app.

Add it to `.env.local`:

```sh
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

Optional fallback provider credentials for search can also be set in the Convex runtime:

```sh
SOUNDCLOUD_CLIENT_ID=...
SOUNDCLOUD_CLIENT_SECRET=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

Notes:

- Room creation also supports entering Spotify and SoundCloud credentials per room in the UI.
- If a room has provider-specific credentials saved, those take precedence over fallback environment credentials.

### Install and run

With Bun:

```sh
bun install
bunx convex dev
bun run dev
```

With npm:

```sh
npm install
npx convex dev
npm run dev
```

## Available scripts

```sh
bun run dev
bun run build
bun run preview
bun run check
bun run lint
bun run format
```

## Project structure

```text
src/routes/+page.svelte              Room creation
src/routes/setup/[roomSlug]          QR code and room handoff
src/routes/r/[roomSlug]              Guest request and voting page
src/routes/dj/[roomSlug]             Private DJ board
src/convex                           Convex schema, queries, mutations, and actions
```

## Operational notes

- Admin links are one-time tokens that exchange into a session.
- The DJ board also supports PIN-based login if the link is lost or expires.
- Guest identity is tracked per device so voting can be updated instead of duplicated.
- Search results are provider-aware and the room can enable Spotify, SoundCloud, or both.

## Build

```sh
bun run build
```

Preview the production build locally:

```sh
bun run preview
```

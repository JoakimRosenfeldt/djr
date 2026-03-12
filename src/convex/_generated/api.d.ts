/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as catalog from "../catalog.js";
import type * as catalogStore from "../catalogStore.js";
import type * as crons from "../crons.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_requests from "../lib/requests.js";
import type * as lib_validators from "../lib/validators.js";
import type * as requests from "../requests.js";
import type * as rooms from "../rooms.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  catalog: typeof catalog;
  catalogStore: typeof catalogStore;
  crons: typeof crons;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/helpers": typeof lib_helpers;
  "lib/requests": typeof lib_requests;
  "lib/validators": typeof lib_validators;
  requests: typeof requests;
  rooms: typeof rooms;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

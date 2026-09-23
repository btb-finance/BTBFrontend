/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentChat from "../agentChat.js";
import type * as alertMessages from "../alertMessages.js";
import type * as alerts from "../alerts.js";
import type * as alertsActions from "../alertsActions.js";
import type * as balances from "../balances.js";
import type * as cache from "../cache.js";
import type * as cacheFill from "../cacheFill.js";
import type * as crons from "../crons.js";
import type * as discover from "../discover.js";
import type * as discoverRefresh from "../discoverRefresh.js";
import type * as globalRefresh from "../globalRefresh.js";
import type * as poolFacts from "../poolFacts.js";
import type * as prices from "../prices.js";
import type * as profiles from "../profiles.js";
import type * as profilesActions from "../profilesActions.js";
import type * as queries from "../queries.js";
import type * as questCatalog from "../questCatalog.js";
import type * as quests from "../quests.js";
import type * as rewards from "../rewards.js";
import type * as rewardsActions from "../rewardsActions.js";
import type * as rpcEndpoints from "../rpcEndpoints.js";
import type * as snapshots from "../snapshots.js";
import type * as tokens from "../tokens.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentChat: typeof agentChat;
  alertMessages: typeof alertMessages;
  alerts: typeof alerts;
  alertsActions: typeof alertsActions;
  balances: typeof balances;
  cache: typeof cache;
  cacheFill: typeof cacheFill;
  crons: typeof crons;
  discover: typeof discover;
  discoverRefresh: typeof discoverRefresh;
  globalRefresh: typeof globalRefresh;
  poolFacts: typeof poolFacts;
  prices: typeof prices;
  profiles: typeof profiles;
  profilesActions: typeof profilesActions;
  queries: typeof queries;
  questCatalog: typeof questCatalog;
  quests: typeof quests;
  rewards: typeof rewards;
  rewardsActions: typeof rewardsActions;
  rpcEndpoints: typeof rpcEndpoints;
  snapshots: typeof snapshots;
  tokens: typeof tokens;
  users: typeof users;
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

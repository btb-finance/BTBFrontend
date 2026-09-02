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
import type * as balances from "../balances.js";
import type * as cache from "../cache.js";
import type * as cacheFill from "../cacheFill.js";
import type * as crons from "../crons.js";
import type * as dca from "../dca.js";
import type * as dcaActions from "../dcaActions.js";
import type * as discover from "../discover.js";
import type * as discoverRefresh from "../discoverRefresh.js";
import type * as globalRefresh from "../globalRefresh.js";
import type * as lpSetup from "../lpSetup.js";
import type * as managedPositionMonitor from "../managedPositionMonitor.js";
import type * as managedPositions from "../managedPositions.js";
import type * as markets from "../markets.js";
import type * as marketsRefresh from "../marketsRefresh.js";
import type * as poolFacts from "../poolFacts.js";
import type * as prices from "../prices.js";
import type * as queries from "../queries.js";
import type * as questCatalog from "../questCatalog.js";
import type * as quests from "../quests.js";
import type * as rebalanceMath from "../rebalanceMath.js";
import type * as rebalanceWorker from "../rebalanceWorker.js";
import type * as rewards from "../rewards.js";
import type * as rewardsActions from "../rewardsActions.js";
import type * as rpcEndpoints from "../rpcEndpoints.js";
import type * as snapshots from "../snapshots.js";
import type * as spotSetup from "../spotSetup.js";
import type * as spotTrade from "../spotTrade.js";
import type * as spotTradeQueue from "../spotTradeQueue.js";
import type * as spotTradeWorker from "../spotTradeWorker.js";
import type * as tokens from "../tokens.js";
import type * as users from "../users.js";
import type * as zapAgent from "../zapAgent.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentChat: typeof agentChat;
  balances: typeof balances;
  cache: typeof cache;
  cacheFill: typeof cacheFill;
  crons: typeof crons;
  dca: typeof dca;
  dcaActions: typeof dcaActions;
  discover: typeof discover;
  discoverRefresh: typeof discoverRefresh;
  globalRefresh: typeof globalRefresh;
  lpSetup: typeof lpSetup;
  managedPositionMonitor: typeof managedPositionMonitor;
  managedPositions: typeof managedPositions;
  markets: typeof markets;
  marketsRefresh: typeof marketsRefresh;
  poolFacts: typeof poolFacts;
  prices: typeof prices;
  queries: typeof queries;
  questCatalog: typeof questCatalog;
  quests: typeof quests;
  rebalanceMath: typeof rebalanceMath;
  rebalanceWorker: typeof rebalanceWorker;
  rewards: typeof rewards;
  rewardsActions: typeof rewardsActions;
  rpcEndpoints: typeof rpcEndpoints;
  snapshots: typeof snapshots;
  spotSetup: typeof spotSetup;
  spotTrade: typeof spotTrade;
  spotTradeQueue: typeof spotTradeQueue;
  spotTradeWorker: typeof spotTradeWorker;
  tokens: typeof tokens;
  users: typeof users;
  zapAgent: typeof zapAgent;
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

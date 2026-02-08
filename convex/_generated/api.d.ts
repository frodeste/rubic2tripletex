/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiCredentials from "../apiCredentials.js";
import type * as crons from "../crons.js";
import type * as customerMapping from "../customerMapping.js";
import type * as departmentMapping from "../departmentMapping.js";
import type * as integrationSchedules from "../integrationSchedules.js";
import type * as invoiceMapping from "../invoiceMapping.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_rubicClient from "../lib/rubicClient.js";
import type * as lib_tripletexClient from "../lib/tripletexClient.js";
import type * as organizations from "../organizations.js";
import type * as productMapping from "../productMapping.js";
import type * as scheduler from "../scheduler.js";
import type * as sync from "../sync.js";
import type * as syncState from "../syncState.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiCredentials: typeof apiCredentials;
  crons: typeof crons;
  customerMapping: typeof customerMapping;
  departmentMapping: typeof departmentMapping;
  integrationSchedules: typeof integrationSchedules;
  invoiceMapping: typeof invoiceMapping;
  "lib/mappers": typeof lib_mappers;
  "lib/rubicClient": typeof lib_rubicClient;
  "lib/tripletexClient": typeof lib_tripletexClient;
  organizations: typeof organizations;
  productMapping: typeof productMapping;
  scheduler: typeof scheduler;
  sync: typeof sync;
  syncState: typeof syncState;
  validators: typeof validators;
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

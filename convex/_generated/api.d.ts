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
import type * as functions from "../functions.js";
import type * as integrationSchedules from "../integrationSchedules.js";
import type * as invitations from "../invitations.js";
import type * as invoiceMapping from "../invoiceMapping.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_auth0Management from "../lib/auth0Management.js";
import type * as lib_mappers from "../lib/mappers.js";
import type * as lib_rubicClient from "../lib/rubicClient.js";
import type * as lib_tripletexClient from "../lib/tripletexClient.js";
import type * as lib_urlValidation from "../lib/urlValidation.js";
import type * as organizations from "../organizations.js";
import type * as productMapping from "../productMapping.js";
import type * as scheduler from "../scheduler.js";
import type * as sync from "../sync.js";
import type * as syncState from "../syncState.js";
import type * as users from "../users.js";
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
  functions: typeof functions;
  integrationSchedules: typeof integrationSchedules;
  invitations: typeof invitations;
  invoiceMapping: typeof invoiceMapping;
  "lib/auth": typeof lib_auth;
  "lib/auth0Management": typeof lib_auth0Management;
  "lib/mappers": typeof lib_mappers;
  "lib/rubicClient": typeof lib_rubicClient;
  "lib/tripletexClient": typeof lib_tripletexClient;
  "lib/urlValidation": typeof lib_urlValidation;
  organizations: typeof organizations;
  productMapping: typeof productMapping;
  scheduler: typeof scheduler;
  sync: typeof sync;
  syncState: typeof syncState;
  users: typeof users;
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

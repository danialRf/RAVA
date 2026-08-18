import type { Database } from "../client";

/**
 * Anything that can run a query: the pool itself or an open transaction.
 *
 * Repository functions take an executor as their first argument so the same
 * function works standalone and inside a larger transaction.
 */
export type Executor =
  Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

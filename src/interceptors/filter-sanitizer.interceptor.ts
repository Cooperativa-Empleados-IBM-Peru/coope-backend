import {Interceptor} from '@loopback/core';
import {HttpErrors, RestBindings} from '@loopback/rest';

// The LoopBack SQL connectors build `ORDER BY` from the `filter.order` strings
// WITHOUT escaping the direction token (`<column> <direction>`), so a crafted
// `?filter={"order":["x ASC||(select ...)"]}` would end up in the SQL text.
// Column names are escaped by the connector, but we still restrict the whole
// clause to `<identifier> [ASC|DESC]`.
const ORDER_CLAUSE = /^[A-Za-z_][A-Za-z0-9_]*(\s+(ASC|DESC))?$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(what: string): never {
  throw new HttpErrors.BadRequest(`Invalid filter: ${what}`);
}

function assertNonNegativeInteger(value: unknown, what: string): void {
  if (value === undefined || value === null) return;
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) invalid(what);
}

/**
 * Throws a 400 when the filter carries an `order`, `limit`, `skip` or `offset`
 * that could alter the SQL text built by the connector.
 */
export function assertSafeFilter(filter: Record<string, unknown>): void {
  const {order} = filter;
  if (order !== undefined && order !== null) {
    const clauses = Array.isArray(order) ? order : [order];
    for (const clause of clauses) {
      if (typeof clause !== 'string' || !ORDER_CLAUSE.test(clause.trim())) {
        invalid('order');
      }
    }
  }
  assertNonNegativeInteger(filter.limit, 'limit');
  assertNonNegativeInteger(filter.skip, 'skip');
  assertNonNegativeInteger(filter.offset, 'offset');
}

/**
 * Global interceptor: filters only reach the controllers through query
 * strings (GET requests), so every object argument of a GET invocation is
 * checked. Request bodies (POST/PUT/PATCH) are never treated as filters, as
 * they may legitimately contain fields called `order` or `limit`.
 */
export const filterSanitizerInterceptor: Interceptor = async (
  invocationCtx,
  next,
) => {
  const request = invocationCtx.getSync(RestBindings.Http.REQUEST, {
    optional: true,
  });
  if (request?.method === 'GET') {
    for (const arg of invocationCtx.args) {
      if (isPlainObject(arg)) assertSafeFilter(arg);
    }
  }
  return next();
};

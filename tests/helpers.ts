import type { GraphqlClient } from '../src/types.js';

interface Route {
  match: RegExp;
  respond: () => unknown;
}

export function createMockGql(routes: Route[]): GraphqlClient & {
  calls: Array<{ query: string; vars?: Record<string, unknown> }>;
} {
  const calls: Array<{ query: string; vars?: Record<string, unknown> }> = [];
  const fn = (async (query: string, vars?: Record<string, unknown>) => {
    calls.push({ query, vars });
    const route = routes.find((r) => r.match.test(query));
    if (!route) {
      throw new Error(`No mock route for query: ${query.slice(0, 120)}`);
    }
    return route.respond();
  }) as GraphqlClient & {
    calls: Array<{ query: string; vars?: Record<string, unknown> }>;
  };
  fn.calls = calls;
  return fn;
}

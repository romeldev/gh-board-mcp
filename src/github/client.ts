import { graphql } from '@octokit/graphql';
import type { GraphqlClient } from '../types.js';

export function createGraphqlClient(token: string): GraphqlClient {
  return graphql.defaults({
    headers: { authorization: `Bearer ${token}` },
  }) as unknown as GraphqlClient;
}

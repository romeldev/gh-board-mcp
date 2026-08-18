import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@octokit/graphql', () => ({
  graphql: { defaults: vi.fn(() => vi.fn()) },
}));

import { graphql } from '@octokit/graphql';
import { createGraphqlClient } from '../src/github/client.js';

describe('createGraphqlClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('configures the client with the Bearer token', () => {
    const client = createGraphqlClient('ghp_abc123');
    expect(graphql.defaults).toHaveBeenCalledWith({
      headers: { authorization: 'Bearer ghp_abc123' },
    });
    expect(typeof client).toBe('function');
  });
});

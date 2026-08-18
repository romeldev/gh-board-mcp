import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { registerTools } from '../src/tools.js';
import { createMockGql } from './helpers.js';

function setup(respond: () => unknown) {
  const gql = createMockGql([
    { match: /./, respond },
  ]);
  const server = new McpServer({ name: 'gh-board-mcp', version: '0.1.0' });
  registerTools(server, gql);
  return { server, gql };
}

describe('registerTools', () => {
  it('registers the 9 tools', () => {
    const { server } = setup(() => ({}));
    // McpServer doesn't expose a list; assert via tool listing from a connected client
    return (async () => {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'test', version: '0.0.0' });
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.listTools();
      expect(result.tools.map((t) => t.name).sort()).toEqual([
        'archive_activity',
        'create_activity',
        'create_project',
        'delete_activity',
        'list_activities',
        'list_projects',
        'move_activity',
        'unarchive_activity',
        'update_activity',
      ]);
      await client.close();
    })();
  });

  it('list_projects returns projects', async () => {
    const { server } = setup(() => ({
      viewer: {
        projectsV2: {
          nodes: [{ id: 'PVT_1', number: 12, title: 'Alpha' }],
        },
      },
    }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'list_projects', arguments: {} });
    const text = result.content[0].text as string;
    expect(text).toContain('Alpha');

    await client.close();
  });
});

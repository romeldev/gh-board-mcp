#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGraphqlClient } from './github/client.js';
import { registerTools } from './tools.js';

const PACKAGE_VERSION = '0.1.0';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(
      'GITHUB_TOKEN is required. Set it before starting the server, e.g. GITHUB_TOKEN=ghp_xxx npx gh-board-mcp',
    );
    process.exit(1);
  }

  const gql = createGraphqlClient(token);
  const server = new McpServer({ name: 'gh-board-mcp', version: PACKAGE_VERSION });
  registerTools(server, gql);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

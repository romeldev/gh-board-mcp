# gh-board-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `gh-board-mcp`, a TypeScript MCP server that lets a user manage GitHub Projects v2 as a personal kanban board — create/read/move/update/delete activities (draft items) across their boards, distributed on npm and run via `npx` over stdio.

**Architecture:** A single MCP server (`McpServer` + `StdioServerTransport`) exposing 7 tools. Tools call a thin domain layer (`src/projects/*`) that issues GraphQL queries/mutations to the GitHub API through an injectable `GraphqlClient` (backed by `@octokit/graphql`). Domain functions take the client as their first argument, which makes them unit-testable with a mock. Authentication is a per-user `GITHUB_TOKEN` env var — never embedded.

**Tech Stack:** TypeScript (strict, ESM, `module: NodeNext`), `@modelcontextprotocol/sdk` ^1.16.0, `@octokit/graphql` ^8.2.0, `zod` ^3.25.0, Vitest for tests, `tsc` for build, `tsx` for dev.

**Spec:** `/home/romel/.claude-code-router/profiles/default-claude-code/claude/plans/hola-playful-starfish.md` (the approved design; this plan argues from it).

## Global Constraints

- Package name must be `gh-board-mcp`; bin name `gh-board-mcp`; license MIT.
- Node >= 18. `"type": "module"` in package.json.
- **ESM rule:** all relative imports MUST use the `.js` extension (e.g. `import { x } from './github/client.js'`) — required by `tsc` with `module: NodeNext`.
- TS `strict: true`.
- Status values are **only** the built-in GitHub defaults: `Todo`, `In Progress`, `Done`. No custom statuses in v1.
- Priority values are **only**: `Urgent`, `High`, `Medium`, `Low`.
- **Never** mutate Status/Priority field options via `updateProjectV2Field` (cards get orphaned). We only *set item field values*, never field options.
- `GITHUB_TOKEN` is required at startup (env var). If missing, log a clear message to stderr and exit non-zero. Scope: `project` (fine-grained read/write) or classic `project`.
- Tool descriptions are written in **English** (community npm package); README in English.
- Each task commits to git. Initial commit happens in Task 1 (`git init`).

## File Structure

```
gh-project/
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── README.md
├── src/
│   ├── index.ts            # entry: read token, create client, start stdio server
│   ├── types.ts            # shared types: Project, Activity, GraphqlClient
│   ├── github/
│   │   └── client.ts       # createGraphqlClient(token)
│   ├── projects/
│   │   ├── list.ts         # listProjects(gql)
│   │   ├── create.ts       # createProject(gql, name) + ensurePriorityField
│   │   ├── fields.ts       # getFieldOptions, resolveOptionId
│   │   └── items.ts        # listActivities, createActivity, moveActivity, updateActivity, deleteActivity
│   └── tools.ts            # registerTools(server, gql) — wires the 7 tools
└── tests/
    ├── helpers.ts          # createMockGql test helper
    ├── client.test.ts
    ├── list.test.ts
    ├── create.test.ts
    ├── fields.test.ts
    ├── items.test.ts
    └── server.test.ts      # MCP wiring via InMemoryTransport
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable test setup and npm scripts the later tasks use (`npm test`, `npm run build`, `npm run dev`).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "gh-board-mcp",
  "version": "0.1.0",
  "description": "MCP server for managing GitHub Projects v2 as a personal kanban board",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "gh-board-mcp": "dist/index.js"
  },
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "mcp",
    "github",
    "projects",
    "kanban",
    "board",
    "model-context-protocol"
  ],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.16.0",
    "@octokit/graphql": "^8.2.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write `.gitignore` and `.env.example`**

`.gitignore`:
```
node_modules/
dist/
.env
```

`.env.example`:
```
# GitHub Personal Access Token (classic scope: project) or fine-grained token
# with Projects read/write. Never commit your real token.
GITHUB_TOKEN=
```

- [ ] **Step 4: Write the failing smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Install dependencies and run the test**

Run: `npm install`
Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 6: Initialize git, set the GitHub remote, commit, and push**

```bash
git init
git add -A
git commit -m "chore: scaffold gh-board-mcp project"
git branch -M main
git remote add origin git@github.com:romeldev/gh-board-mcp.git
git push -u origin main
```

Note: the remote `romeldev/gh-board-mcp` is public and currently empty (no default branch, no files). If a future push is rejected because the remote gained content, reconcile with `git pull --rebase origin main` before pushing again — never `git push --force` over the shared public repo without asking.

---

### Task 2: Shared types and GraphQL client

**Files:**
- Create: `src/types.ts`
- Create: `src/github/client.ts`
- Test: `tests/client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type GraphqlClient = (query: string, variables?: Record<string, unknown>) => Promise<any>`
  - `interface Project { id: string; number: number; title: string }`
  - `interface Activity { itemId: string; draftIssueId: string; title: string; body: string | null; status: string | null; priority: string | null }`
  - `interface FieldOptions { fieldId: string; options: Record<string, string> }` (optionName → optionId)
  - `createGraphqlClient(token: string): GraphqlClient`

- [ ] **Step 1: Write the failing test**

`tests/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@octokit/graphql', () => ({
  default: { defaults: vi.fn(() => vi.fn()) },
}));

import graphql from '@octokit/graphql';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module `../src/github/client.js` not found.

- [ ] **Step 3: Write minimal implementation**

`src/types.ts`:
```ts
export type GraphqlClient = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<any>;

export interface Project {
  id: string;
  number: number;
  title: string;
}

export interface Activity {
  /** id of the ProjectV2Item node (used by move/delete/update) */
  itemId: string;
  /** id of the underlying DraftIssue node (needed by updateProjectV2DraftIssue) */
  draftIssueId: string;
  title: string;
  body: string | null;
  status: string | null;
  priority: string | null;
}

/** name → optionId for a single-select field */
export interface FieldOptions {
  fieldId: string;
  options: Record<string, string>;
}
```

`src/github/client.ts`:
```ts
import graphql from '@octokit/graphql';
import type { GraphqlClient } from '../types.js';

export function createGraphqlClient(token: string): GraphqlClient {
  return graphql.defaults({
    headers: { authorization: `Bearer ${token}` },
  }) as unknown as GraphqlClient;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 2 tests total.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shared types and GraphQL client"
```

---

### Task 3: `list_projects` domain — listProjects

**Files:**
- Create: `src/projects/list.ts`
- Test: `tests/list.test.ts`
- Modify: `tests/helpers.ts` (shared mock helper)

**Interfaces:**
- Consumes: `GraphqlClient`, `Project` from Task 2.
- Produces: `listProjects(gql: GraphqlClient): Promise<Project[]>`

- [ ] **Step 1: Write the shared mock helper**

`tests/helpers.ts`:
```ts
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
```

- [ ] **Step 2: Write the failing test**

`tests/list.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { listProjects } from '../src/projects/list.js';
import { createMockGql } from './helpers.js';

describe('listProjects', () => {
  it('returns projects from viewer.projectsV2', async () => {
    const gql = createMockGql([
      {
        match: /projectsV2/,
        respond: () => ({
          viewer: {
            projectsV2: {
              nodes: [
                { id: 'PVT_1', number: 12, title: 'Alpha' },
                { id: 'PVT_2', number: 7, title: 'Beta' },
              ],
            },
          },
        }),
      },
    ]);

    const projects = await listProjects(gql);

    expect(projects).toEqual([
      { id: 'PVT_1', number: 12, title: 'Alpha' },
      { id: 'PVT_2', number: 7, title: 'Beta' },
    ]);
    expect(gql.calls[0].query).toContain('projectsV2');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module `../src/projects/list.js` not found.

- [ ] **Step 4: Write minimal implementation**

`src/projects/list.ts`:
```ts
import type { GraphqlClient, Project } from '../types.js';

const LIST_PROJECTS = `
  query ListProjects {
    viewer {
      projectsV2(first: 100) {
        nodes {
          id
          number
          title
        }
      }
    }
  }
`;

export async function listProjects(gql: GraphqlClient): Promise<Project[]> {
  const data = await gql(LIST_PROJECTS);
  const nodes = data.viewer?.projectsV2?.nodes ?? [];
  return nodes.map((n: { id: string; number: number; title: string }) => ({
    id: n.id,
    number: n.number,
    title: n.title,
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add listProjects domain function"
```

---

### Task 4: `create_project` domain — createProject

**Files:**
- Create: `src/projects/create.ts`
- Test: `tests/create.test.ts`

**Interfaces:**
- Consumes: `GraphqlClient`, `Project` from Task 2.
- Produces: `createProject(gql: GraphqlClient, name: string): Promise<Project>`

Behavior: query `viewer.id` → `createProjectV2` → ensure a single-select `Priority` field exists (query fields; if absent, `createProjectV2Field` with Urgent/High/Medium/Low). Returns the created project.

- [ ] **Step 1: Write the failing test**

`tests/create.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/projects/create.js';
import { createMockGql } from './helpers.js';

const PRIORITY_FIELD = {
  id: 'f_priority',
  name: 'Priority',
  options: [
    { id: 'o_urgent', name: 'Urgent' },
    { id: 'o_high', name: 'High' },
    { id: 'o_medium', name: 'Medium' },
    { id: 'o_low', name: 'Low' },
  ],
};

describe('createProject', () => {
  it('creates the project and returns it', async () => {
    const gql = createMockGql([
      { match: /viewer\s*\{[^}]*id/, respond: () => ({ viewer: { id: 'U_1' } }) },
      {
        match: /createProjectV2/,
        respond: () => ({
          createProjectV2: {
            projectV2: { id: 'PVT_3', number: 15, title: 'Gamma' },
          },
        }),
      },
      {
        match: /fields/,
        respond: () => ({
          node: {
            fields: {
              nodes: [
                {
                  id: 'f_status',
                  name: 'Status',
                  options: [
                    { id: 'o_todo', name: 'Todo' },
                    { id: 'o_ip', name: 'In Progress' },
                    { id: 'o_done', name: 'Done' },
                  ],
                },
              ],
            },
          },
        }),
      },
      {
        match: /createProjectV2Field/,
        respond: () => ({
          createProjectV2Field: { projectV2Field: PRIORITY_FIELD },
        }),
      },
    ]);

    const project = await createProject(gql, 'Gamma');

    expect(project).toEqual({ id: 'PVT_3', number: 15, title: 'Gamma' });
    // Priority field was created because it was missing
    expect(gql.calls.some((c) => /createProjectV2Field/.test(c.query))).toBe(true);
    const createCall = gql.calls.find((c) => /createProjectV2\(/.test(c.query));
    expect(createCall?.vars).toEqual({ ownerId: 'U_1', title: 'Gamma' });
  });

  it('does not create Priority field when it already exists', async () => {
    const gql = createMockGql([
      { match: /viewer\s*\{[^}]*id/, respond: () => ({ viewer: { id: 'U_1' } }) },
      {
        match: /createProjectV2/,
        respond: () => ({
          createProjectV2: {
            projectV2: { id: 'PVT_4', number: 16, title: 'Delta' },
          },
        }),
      },
      {
        match: /fields/,
        respond: () => ({
          node: { fields: { nodes: [{ id: 'f_status', name: 'Status', options: [] }, PRIORITY_FIELD] } },
        }),
      },
    ]);

    await createProject(gql, 'Delta');

    expect(gql.calls.some((c) => /createProjectV2Field/.test(c.query))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/projects/create.ts`:
```ts
import type { GraphqlClient, Project } from '../types.js';

const GET_VIEWER_ID = `
  query GetViewerId {
    viewer {
      id
    }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProject($ownerId: ID!, $title: String!) {
    createProjectV2(input: { ownerId: $ownerId, title: $title }) {
      projectV2 {
        id
        number
        title
      }
    }
  }
`;

const GET_FIELDS = `
  query GetFields($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_PRIORITY_FIELD = `
  mutation CreatePriorityField($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
    createProjectV2Field(input: {
      projectId: $projectId
      name: $name
      dataType: SINGLE_SELECT
      singleSelectOptions: $options
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField {
          id
          name
        }
      }
    }
  }
`;

const PRIORITY_OPTIONS = ['Urgent', 'High', 'Medium', 'Low'].map((name) => ({ name }));

async function getFieldNames(gql: GraphqlClient, projectId: string): Promise<string[]> {
  const data = await gql(GET_FIELDS, { projectId });
  const nodes = data.node?.fields?.nodes ?? [];
  return nodes.map((n: { name: string }) => n.name);
}

async function ensurePriorityField(gql: GraphqlClient, projectId: string): Promise<void> {
  const names = await getFieldNames(gql, projectId);
  if (names.includes('Priority')) return;
  await gql(CREATE_PRIORITY_FIELD, {
    projectId,
    name: 'Priority',
    options: PRIORITY_OPTIONS,
  });
}

export async function createProject(gql: GraphqlClient, name: string): Promise<Project> {
  const viewerData = await gql(GET_VIEWER_ID);
  const ownerId: string = viewerData.viewer.id;

  const data = await gql(CREATE_PROJECT, { ownerId, title: name });
  const project: Project = data.createProjectV2.projectV2;

  await ensurePriorityField(gql, project.id);
  return project;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add createProject domain function with Priority field guarantee"
```

---

### Task 5: Field option resolution helper

**Files:**
- Create: `src/projects/fields.ts`
- Test: `tests/fields.test.ts`

**Interfaces:**
- Consumes: `GraphqlClient`, `FieldOptions` from Task 2.
- Produces:
  - `getFieldOptions(gql: GraphqlClient, projectId: string, fieldName: string): Promise<FieldOptions>` — throws if field not found.
  - `resolveOptionId(field: FieldOptions, value: string): string` — throws listing valid values if `value` is not an option.

- [ ] **Step 1: Write the failing test**

`tests/fields.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getFieldOptions, resolveOptionId } from '../src/projects/fields.js';
import { createMockGql } from './helpers.js';

describe('getFieldOptions', () => {
  it('maps option names to ids for the requested field', async () => {
    const gql = createMockGql([
      {
        match: /fields/,
        respond: () => ({
          node: {
            fields: {
              nodes: [
                {
                  id: 'f_status',
                  name: 'Status',
                  options: [
                    { id: 'o_todo', name: 'Todo' },
                    { id: 'o_ip', name: 'In Progress' },
                    { id: 'o_done', name: 'Done' },
                  ],
                },
              ],
            },
          },
        }),
      },
    ]);

    const field = await getFieldOptions(gql, 'PVT_1', 'Status');

    expect(field).toEqual({
      fieldId: 'f_status',
      options: { Todo: 'o_todo', 'In Progress': 'o_ip', Done: 'o_done' },
    });
  });

  it('throws when the field does not exist', async () => {
    const gql = createMockGql([
      {
        match: /fields/,
        respond: () => ({ node: { fields: { nodes: [] } } }),
      },
    ]);

    await expect(getFieldOptions(gql, 'PVT_1', 'Priority')).rejects.toThrow(
      'Field "Priority" not found',
    );
  });
});

describe('resolveOptionId', () => {
  it('throws with valid options when value is unknown', () => {
    const field = { fieldId: 'f_status', options: { Todo: 'o_todo', Done: 'o_done' } };
    expect(() => resolveOptionId(field, 'Backlog')).toThrow(
      /Valid options are: Todo, Done/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/projects/fields.ts`:
```ts
import type { FieldOptions, GraphqlClient } from '../types.js';

const GET_FIELDS = `
  query GetFields($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 100) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

export async function getFieldOptions(
  gql: GraphqlClient,
  projectId: string,
  fieldName: string,
): Promise<FieldOptions> {
  const data = await gql(GET_FIELDS, { projectId });
  const nodes: Array<{ id: string; name: string; options: Array<{ id: string; name: string }> }> =
    data.node?.fields?.nodes ?? [];

  const field = nodes.find((n) => n.name === fieldName);
  if (!field) {
    throw new Error(`Field "${fieldName}" not found in project ${projectId}`);
  }

  const options: Record<string, string> = {};
  for (const opt of field.options) {
    options[opt.name] = opt.id;
  }
  return { fieldId: field.id, options };
}

export function resolveOptionId(field: FieldOptions, value: string): string {
  const optionId = field.options[value];
  if (!optionId) {
    const valid = Object.keys(field.options).join(', ');
    throw new Error(`Unknown option "${value}". Valid options are: ${valid}`);
  }
  return optionId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add field option resolution helpers"
```

---

### Task 6: Activities domain — list, create, move

**Files:**
- Create: `src/projects/items.ts`
- Test: `tests/items.test.ts`

**Interfaces:**
- Consumes: `GraphqlClient`, `Activity`, `Project`, `FieldOptions` from Task 2; `getFieldOptions`, `resolveOptionId` from Task 5; `createProject` patterns from Task 4.
- Produces:
  - `resolveProject(gql: GraphqlClient, number: number): Promise<Project>` — queries `viewer.projectV2(number)`.
  - `listActivities(gql: GraphqlClient, number: number, filter?: { status?: string; priority?: string }): Promise<Activity[]>`
  - `createActivity(gql: GraphqlClient, number: number, input: { title: string; description?: string; status?: string; priority?: string }): Promise<Activity>`
  - `moveActivity(gql: GraphqlClient, number: number, itemId: string, status: string, priority?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`tests/items.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  resolveProject,
  listActivities,
  createActivity,
  moveActivity,
} from '../src/projects/items.js';
import { createMockGql } from './helpers.js';

const STATUS_FIELD = {
  id: 'f_status',
  name: 'Status',
  options: [
    { id: 'o_todo', name: 'Todo' },
    { id: 'o_ip', name: 'In Progress' },
    { id: 'o_done', name: 'Done' },
  ],
};
const PRIORITY_FIELD = {
  id: 'f_priority',
  name: 'Priority',
  options: [
    { id: 'o_high', name: 'High' },
    { id: 'o_low', name: 'Low' },
  ],
};
const FIELDS = () => ({ node: { fields: { nodes: [STATUS_FIELD, PRIORITY_FIELD] } } });

describe('resolveProject', () => {
  it('returns the project for the given number', async () => {
    const gql = createMockGql([
      {
        match: /projectV2\(number/,
        respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }),
      },
    ]);

    const project = await resolveProject(gql, 12);

    expect(project).toEqual({ id: 'PVT_12', number: 12, title: 'Alpha' });
    expect(gql.calls[0].vars).toEqual({ number: 12 });
  });

  it('throws when the project does not exist', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: null } }) },
    ]);

    await expect(resolveProject(gql, 999)).rejects.toThrow('Project #999 not found');
  });
});

describe('listActivities', () => {
  it('returns draft items with status and priority', async () => {
    const gql = createMockGql([
      {
        match: /items/,
        respond: () => ({
          viewer: {
            projectV2: {
              id: 'PVT_12',
              items: {
                nodes: [
                  {
                    id: 'item_1',
                    content: { id: 'draft_1', title: 'Design UX', body: 'notes' },
                    status: { name: 'In Progress' },
                    priority: { name: 'High' },
                  },
                  {
                    id: 'item_2',
                    content: { id: 'draft_2', title: 'Setup repo', body: null },
                    status: null,
                    priority: null,
                  },
                ],
              },
            },
          },
        }),
      },
    ]);

    const activities = await listActivities(gql, 12);

    expect(activities).toEqual([
      { itemId: 'item_1', draftIssueId: 'draft_1', title: 'Design UX', body: 'notes', status: 'In Progress', priority: 'High' },
      { itemId: 'item_2', draftIssueId: 'draft_2', title: 'Setup repo', body: null, status: null, priority: null },
    ]);
  });

  it('filters by status', async () => {
    const gql = createMockGql([
      {
        match: /items/,
        respond: () => ({
          viewer: {
            projectV2: {
              id: 'PVT_12',
              items: {
                nodes: [
                  { id: 'item_1', content: { id: 'draft_1', title: 'A', body: null }, status: { name: 'Done' }, priority: null },
                  { id: 'item_2', content: { id: 'draft_2', title: 'B', body: null }, status: { name: 'Todo' }, priority: null },
                ],
              },
            },
          },
        }),
      },
    ]);

    const activities = await listActivities(gql, 12, { status: 'Done' });

    expect(activities).toHaveLength(1);
    expect(activities[0].title).toBe('A');
  });

  it('combines status and priority filters', async () => {
    const gql = createMockGql([
      {
        match: /items/,
        respond: () => ({
          viewer: {
            projectV2: {
              id: 'PVT_12',
              items: {
                nodes: [
                  { id: 'item_1', content: { id: 'draft_1', title: 'A', body: null }, status: { name: 'In Progress' }, priority: { name: 'High' } },
                  { id: 'item_2', content: { id: 'draft_2', title: 'B', body: null }, status: { name: 'In Progress' }, priority: { name: 'Low' } },
                ],
              },
            },
          },
        }),
      },
    ]);

    const activities = await listActivities(gql, 12, { status: 'In Progress', priority: 'High' });

    expect(activities).toHaveLength(1);
    expect(activities[0].title).toBe('A');
  });
});

describe('createActivity', () => {
  it('creates a draft item and sets status/priority', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      { match: /fields/, respond: FIELDS },
      {
        match: /createProjectV2DraftIssue/,
        respond: () => ({ createProjectV2DraftIssue: { projectItem: { id: 'item_new' } } }),
      },
      {
        match: /updateProjectV2ItemFieldValue/,
        respond: () => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item_new' } } }),
      },
    ]);

    const activity = await createActivity(gql, 12, {
      title: 'Design UX',
      description: 'notes',
      status: 'In Progress',
      priority: 'High',
    });

    expect(activity.itemId).toBe('item_new');
    expect(activity.status).toBe('In Progress');
    expect(activity.priority).toBe('High');

    const draftCall = gql.calls.find((c) => /createProjectV2DraftIssue/.test(c.query));
    expect(draftCall?.vars).toEqual({
      projectId: 'PVT_12',
      title: 'Design UX',
      body: 'notes',
    });
    // status + priority = 2 field updates
    expect(gql.calls.filter((c) => /updateProjectV2ItemFieldValue/.test(c.query))).toHaveLength(2);
  });
});

describe('moveActivity', () => {
  it('updates the Status field and optional Priority', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      { match: /fields/, respond: FIELDS },
      {
        match: /updateProjectV2ItemFieldValue/,
        respond: () => ({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item_1' } } }),
      },
    ]);

    await moveActivity(gql, 12, 'item_1', 'Done', 'Low');

    const updates = gql.calls.filter((c) => /updateProjectV2ItemFieldValue/.test(c.query));
    expect(updates).toHaveLength(2);
    expect(updates[0].vars).toEqual({
      projectId: 'PVT_12',
      itemId: 'item_1',
      fieldId: 'f_status',
      optionId: 'o_done',
    });
    expect(updates[1].vars).toEqual({
      projectId: 'PVT_12',
      itemId: 'item_1',
      fieldId: 'f_priority',
      optionId: 'o_low',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/projects/items.ts`:
```ts
import type { Activity, GraphqlClient, Project } from '../types.js';
import { getFieldOptions, resolveOptionId } from './fields.js';

const RESOLVE_PROJECT = `
  query ResolveProject($number: Int!) {
    viewer {
      projectV2(number: $number) {
        id
        number
        title
      }
    }
  }
`;

const LIST_ITEMS = `
  query ListItems($number: Int!) {
    viewer {
      projectV2(number: $number) {
        id
        items(first: 100) {
          nodes {
            id
            content {
              ... on DraftIssue {
                id
                title
                body
              }
            }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
            priority: fieldValueByName(name: "Priority") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_DRAFT = `
  mutation CreateDraft($projectId: ID!, $title: String!, $body: String) {
    createProjectV2DraftIssue(input: {
      projectId: $projectId
      title: $title
      body: $body
    }) {
      projectItem {
        id
      }
    }
  }
`;

const UPDATE_FIELD_VALUE = `
  mutation UpdateFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item {
        id
      }
    }
  }
`;

export async function resolveProject(
  gql: GraphqlClient,
  number: number,
): Promise<Project> {
  const data = await gql(RESOLVE_PROJECT, { number });
  const project = data.viewer?.projectV2;
  if (!project) {
    throw new Error(`Project #${number} not found`);
  }
  return project;
}

interface ListItemNode {
  id: string;
  content: { id: string; title: string; body: string | null } | null;
  status: { name: string } | null;
  priority: { name: string } | null;
}

export async function listActivities(
  gql: GraphqlClient,
  number: number,
  filter?: { status?: string; priority?: string },
): Promise<Activity[]> {
  const data = await gql(LIST_ITEMS, { number });
  const nodes: ListItemNode[] = data.viewer?.projectV2?.items?.nodes ?? [];

  const activities: Activity[] = nodes.map((n) => ({
    itemId: n.id,
    draftIssueId: n.content?.id ?? '',
    title: n.content?.title ?? '',
    body: n.content?.body ?? null,
    status: n.status?.name ?? null,
    priority: n.priority?.name ?? null,
  }));

  return activities.filter((a) => {
    const statusOk = !filter?.status || a.status === filter.status;
    const priorityOk = !filter?.priority || a.priority === filter.priority;
    return statusOk && priorityOk;
  });
}

export async function createActivity(
  gql: GraphqlClient,
  number: number,
  input: { title: string; description?: string; status?: string; priority?: string },
): Promise<Activity> {
  const project = await resolveProject(gql, number);

  const data = await gql(CREATE_DRAFT, {
    projectId: project.id,
    title: input.title,
    body: input.description ?? null,
  });
  const itemId: string = data.createProjectV2DraftIssue.projectItem.id;

  if (input.status) {
    const statusField = await getFieldOptions(gql, project.id, 'Status');
    await setFieldValue(gql, project.id, itemId, statusField.fieldId, resolveOptionId(statusField, input.status));
  }
  if (input.priority) {
    const priorityField = await getFieldOptions(gql, project.id, 'Priority');
    await setFieldValue(gql, project.id, itemId, priorityField.fieldId, resolveOptionId(priorityField, input.priority));
  }

  return {
    itemId,
    draftIssueId: '',
    title: input.title,
    body: input.description ?? null,
    status: input.status ?? null,
    priority: input.priority ?? null,
  };
}

export async function moveActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
  status: string,
  priority?: string,
): Promise<void> {
  const project = await resolveProject(gql, number);

  const statusField = await getFieldOptions(gql, project.id, 'Status');
  await setFieldValue(gql, project.id, itemId, statusField.fieldId, resolveOptionId(statusField, status));

  if (priority) {
    const priorityField = await getFieldOptions(gql, project.id, 'Priority');
    await setFieldValue(gql, project.id, itemId, priorityField.fieldId, resolveOptionId(priorityField, priority));
  }
}

async function setFieldValue(
  gql: GraphqlClient,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<void> {
  await gql(UPDATE_FIELD_VALUE, { projectId, itemId, fieldId, optionId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add list/create/move activities domain"
```

---

### Task 7: Activities domain — update and delete

**Files:**
- Modify: `src/projects/items.ts`
- Modify: `tests/items.test.ts` (append tests)

**Interfaces:**
- Consumes: everything from Task 6; `Activity` type.
- Produces:
  - `updateActivity(gql: GraphqlClient, number: number, itemId: string, changes: { title?: string; description?: string }): Promise<void>` — resolves item → draftIssueId, then `updateProjectV2DraftIssue`.
  - `deleteActivity(gql: GraphqlClient, number: number, itemId: string): Promise<void>` — `deleteProjectV2Item`.

- [ ] **Step 1: Write the failing test (append to `tests/items.test.ts`)**

```ts
describe('updateActivity', () => {
  it('updates title and body via updateProjectV2DraftIssue', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      {
        match: /node\(id/,
        respond: () => ({ node: { content: { id: 'draft_1' } } }),
      },
      {
        match: /updateProjectV2DraftIssue/,
        respond: () => ({ updateProjectV2DraftIssue: { draftIssue: { id: 'draft_1', title: 'Design UI', body: 'new notes' } } }),
      },
    ]);

    await updateActivity(gql, 12, 'item_1', { title: 'Design UI', description: 'new notes' });

    const updateCall = gql.calls.find((c) => /updateProjectV2DraftIssue/.test(c.query));
    expect(updateCall?.vars).toEqual({
      draftIssueId: 'draft_1',
      title: 'Design UI',
      body: 'new notes',
    });
  });
});

describe('deleteActivity', () => {
  it('deletes the item from the project', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      {
        match: /deleteProjectV2Item/,
        respond: () => ({ deleteProjectV2Item: { deletedItemId: 'item_1' } }),
      },
    ]);

    await deleteActivity(gql, 12, 'item_1');

    const deleteCall = gql.calls.find((c) => /deleteProjectV2Item/.test(c.query));
    expect(deleteCall?.vars).toEqual({ projectId: 'PVT_12', itemId: 'item_1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `updateActivity`/`deleteActivity` not defined.

- [ ] **Step 3: Write minimal implementation (append to `src/projects/items.ts`)**

```ts
const GET_ITEM_CONTENT = `
  query GetItemContent($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        content {
          ... on DraftIssue {
            id
          }
        }
      }
    }
  }
`;

const UPDATE_DRAFT = `
  mutation UpdateDraft($draftIssueId: ID!, $title: String, $body: String) {
    updateProjectV2DraftIssue(input: {
      draftIssueId: $draftIssueId
      title: $title
      body: $body
    }) {
      draftIssue {
        id
        title
        body
      }
    }
  }
`;

const DELETE_ITEM = `
  mutation DeleteItem($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: {
      projectId: $projectId
      itemId: $itemId
    }) {
      deletedItemId
    }
  }
`;

export async function updateActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
  changes: { title?: string; description?: string },
): Promise<void> {
  await resolveProject(gql, number);

  const contentData = await gql(GET_ITEM_CONTENT, { itemId });
  const draftIssueId: string = contentData.node?.content?.id;
  if (!draftIssueId) {
    throw new Error(`Item ${itemId} is not a draft issue`);
  }

  await gql(UPDATE_DRAFT, {
    draftIssueId,
    title: changes.title ?? null,
    body: changes.description ?? null,
  });
}

export async function deleteActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
): Promise<void> {
  const project = await resolveProject(gql, number);
  await gql(DELETE_ITEM, { projectId: project.id, itemId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add update/delete activity domain"
```

---

### Task 8: MCP tools registration and entry point

**Files:**
- Create: `src/tools.ts`
- Create: `src/index.ts`
- Test: `tests/server.test.ts`

**Interfaces:**
- Consumes: domain functions from Tasks 3–7; `GraphqlClient` from Task 2; `McpServer` from the SDK.
- Produces:
  - `registerTools(server: McpServer, gql: GraphqlClient): void`
  - `src/index.ts` reads `GITHUB_TOKEN`, creates client, starts server on stdio.

- [ ] **Step 1: Write the failing server test**

`tests/server.test.ts`:
```ts
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
  it('registers the 7 tools', () => {
    const { server } = setup(() => ({}));
    // McpServer doesn't expose a list; assert via tool listing from a connected client
    return (async () => {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'test', version: '0.0.0' });
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.listTools();
      expect(result.tools.map((t) => t.name).sort()).toEqual([
        'create_activity',
        'create_project',
        'delete_activity',
        'list_activities',
        'list_projects',
        'move_activity',
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `../src/tools.js` not found.

- [ ] **Step 3: Write minimal implementation**

`src/tools.ts`:
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GraphqlClient } from './types.js';
import { listProjects } from './projects/list.js';
import { createProject } from './projects/create.js';
import {
  listActivities,
  createActivity,
  moveActivity,
  updateActivity,
  deleteActivity,
} from './projects/items.js';

const DEFAULT_STATUSES = 'Todo, In Progress, Done';
const PRIORITIES = 'Urgent, High, Medium, Low';

export function registerTools(server: McpServer, gql: GraphqlClient): void {
  server.tool(
    'list_projects',
    'List all GitHub Projects v2 boards owned by the authenticated user.',
    async () => {
      const projects = await listProjects(gql);
      if (projects.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No projects found.' }] };
      }
      const lines = projects.map((p) => `- #${p.number}: **${p.title}** (\`${p.id}\`)`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'create_project',
    'Create a new GitHub Project v2 board with default Status (Todo/In Progress/Done) and Priority (Urgent/High/Medium/Low) fields.',
    {
      name: z.string().min(1).describe('Name of the new board/project'),
    },
    async ({ name }) => {
      const project = await createProject(gql, name);
      return {
        content: [{ type: 'text' as const, text: `Created project #${project.number}: **${project.title}** (\`${project.id}\`)` }],
      };
    },
  );

  server.tool(
    'list_activities',
    `List activities (draft items) in a board. Filter by status (${DEFAULT_STATUSES}) and/or priority (${PRIORITIES}).`,
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      status: z.string().optional().describe(`Status filter (${DEFAULT_STATUSES})`),
      priority: z.string().optional().describe(`Priority filter (${PRIORITIES})`),
    },
    async ({ projectNumber, status, priority }) => {
      const activities = await listActivities(gql, projectNumber, { status, priority });
      if (activities.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No activities found.' }] };
      }
      const lines = activities.map(
        (a) => `- [${a.status ?? 'no status'}] ${a.title}${a.priority ? ` (priority: ${a.priority})` : ''} — item: \`${a.itemId}\``,
      );
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.tool(
    'create_activity',
    'Create a new activity (draft item) in a board. Optionally set an initial status and priority.',
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      title: z.string().min(1).describe('Title of the activity'),
      description: z.string().optional().describe('Notes/body for the activity'),
      status: z.string().optional().describe(`Initial status (${DEFAULT_STATUSES})`),
      priority: z.string().optional().describe(`Initial priority (${PRIORITIES})`),
    },
    async ({ projectNumber, title, description, status, priority }) => {
      const activity = await createActivity(gql, projectNumber, {
        title,
        description,
        status,
        priority,
      });
      return {
        content: [{ type: 'text' as const, text: `Created activity "${activity.title}" (item: \`${activity.itemId}\`)` }],
      };
    },
  );

  server.tool(
    'move_activity',
    `Move an activity to a different status (${DEFAULT_STATUSES}) and optionally set its priority (${PRIORITIES}).`,
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      itemId: z.string().describe('Item id of the activity (from list_activities)'),
      status: z.string().describe(`Target status (${DEFAULT_STATUSES})`),
      priority: z.string().optional().describe(`Target priority (${PRIORITIES})`),
    },
    async ({ projectNumber, itemId, status, priority }) => {
      await moveActivity(gql, projectNumber, itemId, status, priority);
      return {
        content: [{ type: 'text' as const, text: `Moved item \`${itemId}\` to "${status}"${priority ? ` with priority "${priority}"` : ''}.` }],
      };
    },
  );

  server.tool(
    'update_activity',
    'Edit the title and/or description of an activity (draft item).',
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      itemId: z.string().describe('Item id of the activity (from list_activities)'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description/body'),
    },
    async ({ projectNumber, itemId, title, description }) => {
      await updateActivity(gql, projectNumber, itemId, { title, description });
      return {
        content: [{ type: 'text' as const, text: `Updated item \`${itemId}\`.` }],
      };
    },
  );

  server.tool(
    'delete_activity',
    'Delete an activity (draft item) from a board.',
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      itemId: z.string().describe('Item id of the activity (from list_activities)'),
    },
    async ({ projectNumber, itemId }) => {
      await deleteActivity(gql, projectNumber, itemId);
      return {
        content: [{ type: 'text' as const, text: `Deleted item \`${itemId}\`.` }],
      };
    },
  );
}
```

`src/index.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests (unit + server wiring).

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: `dist/index.js` produced, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: register MCP tools and entry point"
```

---

### Task 9: README, publish config, end-to-end verification

**Files:**
- Create: `README.md`
- Modify: `package.json` (no changes expected unless verification reveals issues)

**Interfaces:**
- Consumes: nothing new.
- Produces: final documentation and verified package.

- [ ] **Step 1: Write `README.md`**

```markdown
# gh-board-mcp

MCP server for managing **GitHub Projects v2** as a personal kanban board. Create activities (draft items), move them between columns, track priority — without linking to real issues.

## Requirements

- Node.js >= 18
- A [GitHub Personal Access Token](https://github.com/settings/tokens) with the **project** scope (fine-grained: Projects read/write)

## Usage

```bash
GITHUB_TOKEN=ghp_xxx npx gh-board-mcp
```

Configure it in your MCP client (e.g. Claude Code):

```bash
claude mcp add gh-board-mcp -- env GITHUB_TOKEN=ghp_xxx npx gh-board-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List your GitHub Projects v2 boards |
| `create_project` | Create a new board (default Status + Priority fields) |
| `list_activities` | List activities (draft items), filter by status/priority |
| `create_activity` | Create an activity with optional status/priority |
| `move_activity` | Move an activity to another status (and set priority) |
| `update_activity` | Edit an activity's title/description |
| `delete_activity` | Delete an activity |

## Status & Priority

- Status values are GitHub's built-in defaults: **Todo, In Progress, Done**
- Priority values: **Urgent, High, Medium, Low**
- Custom columns are not supported via the API (configure them in the GitHub UI).

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## License

MIT
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Build and smoke-test locally without a token**

Run: `GITHUB_TOKEN= npm run build && node dist/index.js`
Expected: prints the "GITHUB_TOKEN is required" error to stderr and exits 1.

- [ ] **Step 4: Package check**

Run: `npm pack --dry-run`
Expected: tarball contains `dist/`, `README.md`, `package.json`; no `src/`, `tests/`, `.env`.

- [ ] **Step 5: Live verification (requires a real token)**

Run: `GITHUB_TOKEN=<your token> npm run dev` in a terminal (leave it running).
In another terminal, confirm the server responds — e.g. connect via a client or run `claude mcp add gh-board-mcp -- env GITHUB_TOKEN=<your token> npx gh-board-mcp` then `claude mcp list` and exercise the tools against a test board.

Expected: the 7 tools are listed; a smoke flow works: `list_projects` → `create_activity` → `list_activities` → `move_activity` → `delete_activity`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: add README and finalize package"
```

---

## Self-Review

**Spec coverage:** list_projects (Task 3), create_project (Task 4), priority field guarantee (Task 4), field resolution (Task 5), list/create/move activities (Task 6), update/delete (Task 7), all 7 tools + stdio + token check (Task 8), README + publish verification (Task 9). Status values restricted to GitHub defaults everywhere (Global Constraints + tool descriptions). No custom statuses, no org projects (viewer only), no archiving — all explicitly out of scope in the spec.

**Placeholder scan:** every step has concrete code and commands; no "TBD"/"TODO".

**Type consistency:** `GraphqlClient`, `Project`, `Activity`, `FieldOptions` defined once in `types.ts` (Task 2) and used identically across Tasks 3–8. `resolveProject`/`listActivities`/`createActivity`/`moveActivity` signatures in Task 6 are used verbatim by `tools.ts` in Task 8. `updateActivity(gql, number, itemId, { title?, description? })` and `deleteActivity(gql, number, itemId)` from Task 7 match the tool handlers. The shared mock helper `createMockGql` is defined in Task 3 and reused by all later test files.

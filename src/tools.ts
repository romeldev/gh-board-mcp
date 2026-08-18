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
const OPTIONS_HINT = `Valid values depend on the project (new boards: ${DEFAULT_STATUSES} / ${PRIORITIES}).`;

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
    `List activities (draft items) in a board. Filter by status and/or priority. ${OPTIONS_HINT}`,
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      status: z.string().optional().describe(`Status filter. ${OPTIONS_HINT}`),
      priority: z.string().optional().describe(`Priority filter. ${OPTIONS_HINT}`),
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
      status: z.string().optional().describe(`Initial status. ${OPTIONS_HINT}`),
      priority: z.string().optional().describe(`Initial priority. ${OPTIONS_HINT}`),
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
    `Move an activity to a different status and optionally set its priority. ${OPTIONS_HINT}`,
    {
      projectNumber: z.number().int().positive().describe('Number of the GitHub Project board'),
      itemId: z.string().describe('Item id of the activity (from list_activities)'),
      status: z.string().describe(`Target status. ${OPTIONS_HINT}`),
      priority: z.string().optional().describe(`Target priority. ${OPTIONS_HINT}`),
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

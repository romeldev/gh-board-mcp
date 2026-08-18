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

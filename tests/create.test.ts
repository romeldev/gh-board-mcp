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
      {
        match: /views\(first/,
        respond: () => ({
          node: { views: { nodes: [{ id: 'v_1', layout: 'TABLE_LAYOUT' }] } },
        }),
      },
      {
        match: /updateProjectV2View/,
        respond: () => ({
          updateProjectV2View: {
            projectV2View: { id: 'v_1', name: 'View 1', layout: 'BOARD_LAYOUT' },
          },
        }),
      },
    ]);

    const project = await createProject(gql, 'Gamma');

    expect(project).toEqual({ id: 'PVT_3', number: 15, title: 'Gamma' });
    // Priority field was created because it was missing — each option must
    // carry a non-null color + description (live API requirement).
    const fieldCall = gql.calls.find((c) => /createProjectV2Field/.test(c.query));
    expect(fieldCall).toBeTruthy();
    expect(fieldCall?.vars).toEqual({
      projectId: 'PVT_3',
      name: 'Priority',
      options: [
        { name: 'Urgent', color: 'RED', description: 'Blocks urgent work' },
        { name: 'High', color: 'ORANGE', description: 'Important, near-term' },
        { name: 'Medium', color: 'YELLOW', description: 'Planned work' },
        { name: 'Low', color: 'GREEN', description: 'When time allows' },
      ],
    });
    const createCall = gql.calls.find((c) => /createProjectV2\(/.test(c.query));
    expect(createCall?.vars).toEqual({ ownerId: 'U_1', title: 'Gamma' });
    // Default view is flipped to a board (kanban) layout.
    const viewCall = gql.calls.find((c) => /updateProjectV2View/.test(c.query));
    expect(viewCall?.vars).toEqual({ viewId: 'v_1' });
    expect(viewCall?.query).toContain('layout: BOARD_LAYOUT');
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
      {
        match: /views\(first/,
        respond: () => ({
          node: { views: { nodes: [{ id: 'v_1', layout: 'TABLE_LAYOUT' }] } },
        }),
      },
      {
        match: /updateProjectV2View/,
        respond: () => ({
          updateProjectV2View: {
            projectV2View: { id: 'v_1', name: 'View 1', layout: 'BOARD_LAYOUT' },
          },
        }),
      },
    ]);

    await createProject(gql, 'Delta');

    expect(gql.calls.some((c) => /createProjectV2Field/.test(c.query))).toBe(false);
    expect(gql.calls.some((c) => /updateProjectV2View/.test(c.query))).toBe(true);
  });

  it('does not set board layout when the view is already a board', async () => {
    const gql = createMockGql([
      { match: /viewer\s*\{[^}]*id/, respond: () => ({ viewer: { id: 'U_1' } }) },
      {
        match: /createProjectV2/,
        respond: () => ({
          createProjectV2: {
            projectV2: { id: 'PVT_5', number: 17, title: 'Epsilon' },
          },
        }),
      },
      {
        match: /fields/,
        respond: () => ({
          node: { fields: { nodes: [{ id: 'f_status', name: 'Status', options: [] }, PRIORITY_FIELD] } },
        }),
      },
      {
        match: /views\(first/,
        respond: () => ({
          node: { views: { nodes: [{ id: 'v_1', layout: 'BOARD_LAYOUT' }] } },
        }),
      },
    ]);

    await createProject(gql, 'Epsilon');

    expect(gql.calls.some((c) => /updateProjectV2View/.test(c.query))).toBe(false);
  });
});

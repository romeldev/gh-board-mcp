import { describe, it, expect } from 'vitest';
import {
  resolveProject,
  listActivities,
  createActivity,
  moveActivity,
  updateActivity,
  deleteActivity,
  archiveActivity,
  unarchiveActivity,
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
        match: /addProjectV2DraftIssue/,
        respond: () => ({ addProjectV2DraftIssue: { projectItem: { id: 'item_new' } } }),
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

    const draftCall = gql.calls.find((c) => /addProjectV2DraftIssue/.test(c.query));
    expect(draftCall?.vars).toEqual({
      projectId: 'PVT_12',
      title: 'Design UX',
      body: 'notes',
    });
    // status + priority = 2 field updates
    expect(gql.calls.filter((c) => /updateProjectV2ItemFieldValue/.test(c.query))).toHaveLength(2);
  });

  it('rejects an unknown status WITHOUT creating a draft (no orphaned item)', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      { match: /fields/, respond: FIELDS },
    ]);

    await expect(createActivity(gql, 12, { title: 'Design UX', status: 'Bogus' })).rejects.toThrow(/Unknown option/);

    expect(gql.calls.some((c) => /addProjectV2DraftIssue/.test(c.query))).toBe(false);
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
      input: {
        draftIssueId: 'draft_1',
        title: 'Design UI',
        body: 'new notes',
      },
    });
  });

  it('omits unset fields so a single-field edit does not clear the other', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      {
        match: /node\(id/,
        respond: () => ({ node: { content: { id: 'draft_1' } } }),
      },
      {
        match: /updateProjectV2DraftIssue/,
        respond: () => ({ updateProjectV2DraftIssue: { draftIssue: { id: 'draft_1', title: 'Design UI', body: 'notes' } } }),
      },
    ]);

    // title-only update: the input must NOT carry a body key (null clears it live)
    await updateActivity(gql, 12, 'item_1', { title: 'Design UI' });

    const updateCall = gql.calls.find((c) => /updateProjectV2DraftIssue/.test(c.query));
    expect(updateCall?.vars).toEqual({ input: { draftIssueId: 'draft_1', title: 'Design UI' } });
    expect(updateCall?.vars.input).not.toHaveProperty('body');
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

describe('archiveActivity', () => {
  it('archives the item via archiveProjectV2Item', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      {
        match: /archiveProjectV2Item/,
        respond: () => ({ archiveProjectV2Item: { item: { id: 'item_1' } } }),
      },
    ]);

    await archiveActivity(gql, 12, 'item_1');

    const archiveCall = gql.calls.find((c) => /archiveProjectV2Item/.test(c.query));
    expect(archiveCall?.vars).toEqual({ projectId: 'PVT_12', itemId: 'item_1' });
  });
});

describe('unarchiveActivity', () => {
  it('restores the item via unarchiveProjectV2Item', async () => {
    const gql = createMockGql([
      { match: /projectV2\(number/, respond: () => ({ viewer: { projectV2: { id: 'PVT_12', number: 12, title: 'Alpha' } } }) },
      {
        match: /unarchiveProjectV2Item/,
        respond: () => ({ unarchiveProjectV2Item: { item: { id: 'item_1' } } }),
      },
    ]);

    await unarchiveActivity(gql, 12, 'item_1');

    const unarchiveCall = gql.calls.find((c) => /unarchiveProjectV2Item/.test(c.query));
    expect(unarchiveCall?.vars).toEqual({ projectId: 'PVT_12', itemId: 'item_1' });
  });
});

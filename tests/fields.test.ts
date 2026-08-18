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

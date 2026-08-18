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

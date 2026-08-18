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

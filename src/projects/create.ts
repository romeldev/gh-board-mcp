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

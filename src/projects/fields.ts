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

import type { Activity, FieldOptions, GraphqlClient, Project } from '../types.js';
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
    addProjectV2DraftIssue(input: {
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

  // Resolve status/priority option ids BEFORE creating the draft so a bad option
  // raises an error without leaving an orphaned draft item behind.
  let statusField: FieldOptions | undefined;
  let statusOptionId: string | undefined;
  if (input.status) {
    statusField = await getFieldOptions(gql, project.id, 'Status');
    statusOptionId = resolveOptionId(statusField, input.status);
  }
  let priorityField: FieldOptions | undefined;
  let priorityOptionId: string | undefined;
  if (input.priority) {
    priorityField = await getFieldOptions(gql, project.id, 'Priority');
    priorityOptionId = resolveOptionId(priorityField, input.priority);
  }

  const data = await gql(CREATE_DRAFT, {
    projectId: project.id,
    title: input.title,
    body: input.description ?? null,
  });
  const itemId: string = data.addProjectV2DraftIssue.projectItem.id;

  if (statusField && statusOptionId) {
    await setFieldValue(gql, project.id, itemId, statusField.fieldId, statusOptionId);
  }
  if (priorityField && priorityOptionId) {
    await setFieldValue(gql, project.id, itemId, priorityField.fieldId, priorityOptionId);
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
  mutation UpdateDraft($input: UpdateProjectV2DraftIssueInput!) {
    updateProjectV2DraftIssue(input: $input) {
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

  // Build the input with only the fields being changed. Sending `null` for an
  // unset field makes GitHub CLEAR it (live-verified data-loss bug), so unset
  // keys must be omitted rather than nulled.
  const input: { draftIssueId: string; title?: string; body?: string } = { draftIssueId };
  if (changes.title !== undefined) input.title = changes.title;
  if (changes.description !== undefined) input.body = changes.description;

  await gql(UPDATE_DRAFT, { input });
}

export async function deleteActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
): Promise<void> {
  const project = await resolveProject(gql, number);
  await gql(DELETE_ITEM, { projectId: project.id, itemId });
}

const ARCHIVE_ITEM = `
  mutation ArchiveItem($projectId: ID!, $itemId: ID!) {
    archiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item {
        id
      }
    }
  }
`;

const UNARCHIVE_ITEM = `
  mutation UnarchiveItem($projectId: ID!, $itemId: ID!) {
    unarchiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      item {
        id
      }
    }
  }
`;

async function setItemArchived(
  gql: GraphqlClient,
  projectId: string,
  itemId: string,
  archived: boolean,
): Promise<void> {
  // Two separate API mutations (archiveProjectV2Item / unarchiveProjectV2Item).
  await gql(archived ? ARCHIVE_ITEM : UNARCHIVE_ITEM, { projectId, itemId });
}

export async function archiveActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
): Promise<void> {
  const project = await resolveProject(gql, number);
  await setItemArchived(gql, project.id, itemId, true);
}

export async function unarchiveActivity(
  gql: GraphqlClient,
  number: number,
  itemId: string,
): Promise<void> {
  const project = await resolveProject(gql, number);
  await setItemArchived(gql, project.id, itemId, false);
}

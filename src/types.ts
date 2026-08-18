export type GraphqlClient = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<any>;

export interface Project {
  id: string;
  number: number;
  title: string;
}

export interface Activity {
  /** id of the ProjectV2Item node (used by move/delete/update) */
  itemId: string;
  /** id of the underlying DraftIssue node (needed by updateProjectV2DraftIssue) */
  draftIssueId: string;
  title: string;
  body: string | null;
  status: string | null;
  priority: string | null;
}

/** name → optionId for a single-select field */
export interface FieldOptions {
  fieldId: string;
  options: Record<string, string>;
}

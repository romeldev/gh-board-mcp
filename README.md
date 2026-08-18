# gh-board-mcp

MCP server for managing **GitHub Projects v2** as a personal kanban board. Create activities (draft items), move them between columns, track priority — without linking to real issues.

## Requirements

- Node.js >= 18
- A [GitHub Personal Access Token](https://github.com/settings/tokens) with the **project** scope (fine-grained: Projects read/write)

## Usage

```bash
GITHUB_TOKEN=ghp_xxx npx gh-board-mcp
```

Configure it in your MCP client (e.g. Claude Code):

```bash
claude mcp add gh-board-mcp -- env GITHUB_TOKEN=ghp_xxx npx gh-board-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List your GitHub Projects v2 boards |
| `create_project` | Create a new board (default Status + Priority fields, opens with a board view) |
| `list_activities` | List activities (draft items), filter by status/priority |
| `create_activity` | Create an activity with optional status/priority |
| `move_activity` | Move an activity to another status (and set priority) |
| `update_activity` | Edit an activity's title/description |
| `delete_activity` | Delete an activity |

## Status & Priority

- `create_project` creates a new board with Status = **Todo / In Progress / Done**, Priority = **Urgent / High / Medium / Low**, and a board (kanban) view as its default view.
- Boards created from a GitHub template keep their own Status/Priority options — pass values that exist on the board. `create_activity`, `move_activity`, and `list_activities` report the valid options when given an unknown value.
- Custom columns are not supported via the API (configure them in the GitHub UI).

## Notes

- **Read cap:** `list_activities` and `list_projects` read up to 100 items / projects in one call; larger boards are truncated.
- **Eventual consistency:** GitHub Projects v2 writes can take a moment to appear in reads — a `list_activities` immediately after `create_activity` may briefly miss the new item.
- **Create is not atomic:** `create_activity` validates the status/priority options before creating, so a bad option leaves nothing behind; a transient network error mid-create can still leave a draft without its field values.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## License

MIT

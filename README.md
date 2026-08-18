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
| `create_project` | Create a new board (default Status + Priority fields) |
| `list_activities` | List activities (draft items), filter by status/priority |
| `create_activity` | Create an activity with optional status/priority |
| `move_activity` | Move an activity to another status (and set priority) |
| `update_activity` | Edit an activity's title/description |
| `delete_activity` | Delete an activity |

## Status & Priority

- Status values are GitHub's built-in defaults: **Todo, In Progress, Done**
- Priority values: **Urgent, High, Medium, Low**
- Custom columns are not supported via the API (configure them in the GitHub UI).

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## License

MIT

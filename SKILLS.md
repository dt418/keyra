# Skills & MCPs

This file documents the recommended skills and MCPs for working on the Keyra
project. The actual opencode configuration lives in `.opencode/opencode.json`.

## Recommended Skills

| Skill | Use For |
|-------|---------|
| `shadcn` | Building UI components in the dashboard (base-ui, Vite, Tailwind v4) |
| `shadcn-best-practices` | UI composition recipes, design system integration |
| `cloudflare` | Workers, D1, KV, R2, Vectorize, Hyperdrive configuration |
| `wrangler` | Local dev, deployments, secrets, D1 migrations |
| `react-best-practices` | React patterns, performance, state management |
| `playwright-dev` | E2E tests, MCP browser, CI integration |
| `github` | Repo operations via GitHub CLI, PR/issue management |
| `create-github-action-workflow-specification` | CI/CD workflow specs |
| `best-practices` | General web security, compatibility, code quality |
| `agent-browser` | Live browser debugging and visual QA |
| `ai-sdk` | Future: AI-powered license insights, fraud detection |

## MCP Servers

### `code-review-graph`

- **Type:** stdio (via uvx)
- **Command:** `uvx code-review-graph serve`
- **Purpose:** Code review intelligence — call graphs, dependency analysis,
  impact assessment before refactoring.
- **Use:** Run before making significant changes to understand what files
  are affected by a change.

## When to Invoke

- **Working on UI?** → Load `shadcn` + `shadcn-best-practices` + `react-best-practices`
- **Working on API / Workers?** → Load `cloudflare` + `wrangler`
- **Working on tests?** → Load `playwright-dev` for E2E
- **Working on CI/CD?** → Load `github` + `create-github-action-workflow-specification`
- **Debugging live issues?** → Load `agent-browser` for visual debugging
- **Refactoring?** → Run `code-review-graph` first

## Installation

Skills and MCPs are installed at the user level (`~/.config/opencode/`).
The project-level `.opencode/opencode.json` references the user-level paths,
so they activate automatically when working in this project.

To add a new skill:
```bash
# User-level (recommended)
# Add the skill to ~/.config/opencode/skills/ and reference in .opencode/opencode.json
```

To add a new MCP:
```bash
# Add to .opencode/mcp/mcp.json with the server definition
```

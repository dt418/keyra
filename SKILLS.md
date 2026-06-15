# Skills & MCPs

This project includes AI agent skills installed in `.agents/skills/` so they
are version-controlled and work portably across machines.

## Installation

Skills are installed using the official CLI:

```bash
npx skills add <source> --project -y
```

Examples used to set up this project:

```bash
npx skills add shadcn/ui@shadcn --project -y
npx skills add cloudflare/skills@wrangler --project -y
npx skills add cloudflare/skills@workers-best-practices --project -y
npx skills add cloudflare/skills@durable-objects --project -y
npx skills add vercel-labs/agent-skills@vercel-react-best-practices --project -y
npx skills add qu-skills/skills@agent-browser --project -y
npx skills add shadcn/improve@improve --project -y
```

## Installed Skills (`.agents/skills/`)

| Skill | Use For |
|-------|---------|
| `shadcn` | Building UI components (base-ui, Vite, Tailwind v4) |
| `wrangler` | Local dev, deployments, secrets, D1 migrations |
| `workers-best-practices` | Cloudflare Workers best practices |
| `durable-objects` | Cloudflare Durable Objects (stateful coordination) |
| `vercel-react-best-practices` | React patterns and best practices |
| `agent-browser` | Live browser debugging and visual QA |
| `improve` | Code improvement suggestions |

## MCP Servers

Add MCPs to `.agents/mcp.json` or use the opencode config.

## When to Invoke

- **Working on UI?** → Load `shadcn` + `vercel-react-best-practices` + `improve`
- **Working on API / Workers?** → Load `wrangler` + `workers-best-practices`
- **Working on Durable Objects?** → Load `durable-objects`
- **Working on tests?** → Use `agent-browser` for live debugging
- **Refactoring?** → Use `improve` for code quality suggestions

## Adding New Skills

```bash
# Add a new skill to the project
npx skills add <owner/repo@skill> --project -y
```

The skill is installed to `.agents/skills/<skill-name>/` in the project and
will be picked up by AI agents automatically.

## Why Project-Level Skills?

- **Portability:** Move the project to a new machine and everything works
- **Version control:** Track which skill version is paired with which code version
- **Team consistency:** Every developer gets the same tooling
- **No symlink fragility:** Avoids broken links when paths differ between machines

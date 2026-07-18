# Deploy

Prod topology is still an open decision (see `CONTEXT.md → Open Decisions`):

- **MC server:** local Paper/Fabric for dev (see `infra/docker-compose.yml`).
  Prod target TBD — managed host, our own VPS, or BYO-server (player hosts, bot
  joins).
- **Bot + MCP server:** `bot.Dockerfile` builds a runtime image. Runs anywhere
  that can reach both the MC server and the Hermes process.
- **Hermes:** lives OUTSIDE this repo. Installed + run separately, pointed at
  the MCP endpoint this image exposes on `:3001`.

Nothing here is wired to a real provider yet. Fill in once we pick one.

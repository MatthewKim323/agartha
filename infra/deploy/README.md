# Deploy

Nothing here is wired to a real provider yet.

The shape it assumes:

- **mc-bot** runs wherever it can reach the Minecraft server. It exposes the
  MCP control surface on 127.0.0.1:3001 by default. If you move it off the same
  host as the voice agent, widen `MCP_HOST` *and* set `MCP_AUTH_TOKEN` — those
  tools are full control of the bot.
- **voice-agent** runs wherever it can reach Discord, the MCP endpoint, and
  Gemini. It needs a `GEMINI_API_KEY` and its own Discord bot token.
- **gbrain** is not deployed here. It is an existing always-on server that owns
  the PGLite single-writer lock. Point at it; never start a second one.

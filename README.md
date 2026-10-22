# mcp-app-webmcp-demo

A small [MCP App](https://github.com/modelcontextprotocol/ext-apps) for testing hosts that support
**WebMCP inside MCP Apps**.

The View is a little game, *Lantern Grid*. Instead of the host calling server tools to play it, the View
exposes its own tools with [`document.modelContext.registerTool()`](https://webmachinelearning.github.io/webmcp/),
the direction discussed in
[ext-apps#797](https://github.com/modelcontextprotocol/ext-apps/issues/797) and prototyped in
[ext-apps#798](https://github.com/modelcontextprotocol/ext-apps/pull/798). The tool list changes while you
play, which makes it a useful probe for how a host handles tools that come and go.

The server has no dependencies and no SDK: one file of JSON-RPC over streamable HTTP. Node 20 or newer.

## Play it

**https://kenchris.github.io/mcp-app-webmcp-demo/**

The same file is the MCP App View and a standalone web page, so it is also a plain **WebMCP** demo: open it in a
browser or extension that provides `document.modelContext` and the page registers its tools there, for any agent to
discover and call. Without WebMCP you can still play with the on-screen buttons or the arrow keys (Enter lights a
lantern); the page then says no tools are registered. `?polyfill=1` loads a minimal `document.modelContext`, enough
to try the tools from the console.

## Use it as an MCP App

A web page cannot be an MCP server, so the MCP App needs the small server in this repo. Node 20+, no install step.

**Launched by the host (stdio)**, for hosts with an `mcpServers` config (Claude Desktop, VS Code, Cursor, ...):

```json
{
  "mcpServers": {
    "lantern-grid": {
      "command": "npx",
      "args": ["-y", "github:kenchris/mcp-app-webmcp-demo", "--stdio"]
    }
  }
}
```

**Over HTTP**, for hosts that take a server URL (for example the OpenVINO Web Extension):

```sh
npx -y github:kenchris/mcp-app-webmcp-demo --port 8787     # MCP endpoint: http://127.0.0.1:8787/mcp
```

Hosts that need a public `https` endpoint (ChatGPT, for instance) need the server behind a tunnel.

Then ask the model: *"Start a Lantern Grid game and light all the lanterns."* It opens the view with `start_game`.
If the host supports WebMCP in MCP Apps, the model then plays with the tools the view registers. A host without that
support still shows the view, but the model does not see those tools, which is a result in itself.

From a checkout, `node src/server.mjs --stdio` or `node src/server.mjs --port 8787` does the same.

## Run it from a checkout

```sh
git clone https://github.com/kenchris/mcp-app-webmcp-demo
cd mcp-app-webmcp-demo
node src/server.mjs --port 8787      # MCP endpoint: http://127.0.0.1:8787/mcp
npm test                             # protocol checks for the server
```

The same instructions are on the hosted page, in the "Use it as an MCP App" section.

### Without a host

Open `http://127.0.0.1:8787/view?polyfill=1` in a tab (or the hosted page above with `?polyfill=1`). The variant adds
a minimal `document.modelContext` (`src/dev-polyfill.js`), so you can try the tools from the console:

```js
const tools = await document.modelContext.getTools();
await document.modelContext.executeTool(tools.find(t => t.name === 'look'));
```

Plain `/view` loads the View without a polyfill and shows a banner,
which is what a host that provides no WebMCP looks like.

## How the game works

A grid with a few unlit lanterns. Walk onto each one and light it. When the last one is lit you win, and a
new game can be started with `new_game`.

```
start_game (server tool) ──▶ host opens ui://webmcp-demo/lanterns
                                  │
                      View ◀─ ui/initialize ─▶ host
                      View registers look, count_lit, explode, then move
                                  │
                      model ──▶ move / light_lantern / look ──▶ View
```

## What it exercises

| Tool | Where | Why it is in the demo |
| --- | --- | --- |
| `start_game` | server | Opens the View (`_meta.ui.resourceUri`). `structuredContent.size` is delivered to the View as a tool result |
| `high_scores` | server | A server tool with a purpose near the View's, to see how the model chooses between server and in-frame tools |
| `look` | View | Always there while playing. Read-only (`annotations.readOnlyHint`) |
| `move` | View | **Registered about 250 ms after start**: late registration. Takes an enum argument |
| `light_lantern` | View | Registered **only while standing on an unlit lantern**, so the list changes after every move (`toolchange`) |
| `count_lit` | View | Returns a bare number, not an object |
| `explode` | View | Always throws: the error path |
| `new_game` | View | Appears only after you win, while `look`, `move` and `light_lantern` are **unregistered** through their abort signals |

Also covered: `ui/initialize` and `ui/notifications/initialized`, `ui/update-model-context` after every
state change, `ui/notifications/size-changed`, and a visible banner when the host provides no
`document.modelContext`.

## Checklist for host implementers

The tools the View has registered at each moment:

| Moment | Tools |
| --- | --- |
| just after start | `look`, `count_lit`, `explode`, then `move` after about 250 ms |
| standing on an unlit lantern | the above plus `light_lantern` |
| after lighting the last lantern | `count_lit`, `explode`, `new_game` |
| after `new_game` | `look`, `count_lit`, `explode`, then `move` |

A host passes if:

- the model sees each of these lists as it changes, without the user doing anything (the late `move`, and
  `light_lantern` coming and going);
- a call reaches the View and its result comes back, including the bare number from `count_lit`;
- the error from `explode` arrives as a tool error and does not break the turn;
- tools that were unregistered disappear from the model's list, and nothing from a closed View lingers;
- the View's tools do not collide with server tools such as `start_game`.

`window.__demo` exposes `state()` and `registeredTools()`, so a browser test can compare the View's own idea
of its tools with what the host shows.

## Notes

- The hosted page carries a WebMCP [origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) token for
  `https://kenchris.github.io` (Chrome 149+), so Chrome exposes native WebMCP there. It expires 2027-03-30; renew it and
  update `scripts/build-pages.mjs`. The token is added by the build only, not to `src/view.html`.
- The hosted page is built by `npm run build:pages` (copies `src/view.html` to `docs/index.html`, served from `master` /docs).
- The View is one self-contained HTML file with no external requests, so it works under a strict CSP.
- It never polyfills `document.modelContext` itself. If the host provides none, it shows a banner and
  registers nothing. Providing it is the host's job, as the proposal says.
- The MCP App handshake is hand-rolled in the View (about 30 lines of JSON-RPC over `postMessage`), so there
  is nothing to build or bundle.
- The wire format between host and View for WebMCP tools is still a draft upstream and may change.

## License

Copyright (C) 2026 Kenneth Rohde Christiansen. Apache-2.0, see [LICENSE](LICENSE).

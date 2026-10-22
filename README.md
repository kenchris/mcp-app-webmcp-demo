# mcp-app-webmcp-demo

A small MCP App for testing hosts that support **WebMCP inside MCP Apps**. The View is a game
("Lantern Grid") that exposes its own tools with `document.modelContext.registerTool()`, the way
[ext-apps#797](https://github.com/modelcontextprotocol/ext-apps/issues/797) and
[PR #798](https://github.com/modelcontextprotocol/ext-apps/pull/798) propose. The server has no
dependencies and no SDK: one file of JSON-RPC over streamable HTTP.

## Run

```sh
node src/server.mjs --port 8787      # MCP endpoint: http://127.0.0.1:8787/mcp
npm test                             # protocol checks for the server
```

Add `http://127.0.0.1:8787/mcp` as an MCP server in your host, then ask the model to
"start a Lantern Grid game and light all the lanterns".

Without a host, open the View in a tab: `http://127.0.0.1:8787/view?polyfill=1`. The `polyfill=1`
variant adds a minimal `document.modelContext` (see `src/dev-polyfill.js`), so you can call
`await document.modelContext.getTools()` in the console. Arrow keys move, Enter lights a lantern.

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
| `new_game` | View | Appears only after you win, while `look`, `move` and `light_lantern` are **unregistered** (abort signal) |

Also covered: `ui/initialize` and `ui/notifications/initialized`, `ui/update-model-context` after every
state change, `ui/notifications/size-changed`, and a visible banner when the host provides no
`document.modelContext`.

## Expected tool lists

| Moment | Tools the View has registered |
| --- | --- |
| just after start | `look`, `count_lit`, `explode`, then `move` after ~250 ms |
| on an unlit lantern | the above plus `light_lantern` |
| after lighting the last lantern | `count_lit`, `explode`, `new_game` |
| after `new_game` | `look`, `count_lit`, `explode`, then `move` |

A host passes if its model sees each of these lists as they change, without the user doing anything,
and a tool call reaches the View and comes back (including the error from `explode`).

## Notes

- The View is a single self-contained HTML file with no external requests, so it works under a strict CSP.
- It never calls `registerTool` if `document.modelContext` is missing; it does not polyfill it itself.
  Providing it is the host's job, as the proposal says.
- `window.__demo` exposes `state()` and `registeredTools()` for browser tests.

## License

Apache-2.0

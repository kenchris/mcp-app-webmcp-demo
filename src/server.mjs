// SPDX-License-Identifier: Apache-2.0
// A dependency-free MCP server (streamable HTTP, JSON replies, no sessions) that serves one MCP App.
// The App (src/view.html) exposes its own tools to the host with WebMCP (document.modelContext);
// the server side only has the tools that open the View and read scores.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const VIEW_URI = 'ui://webmcp-demo/lanterns';
const VIEW_MIME = 'text/html;profile=mcp-app';
const VIEW_PATH = fileURLToPath(new URL('./view.html', import.meta.url));
const DEV_POLYFILL_PATH = fileURLToPath(new URL('./dev-polyfill.js', import.meta.url));

const TOOLS = [
  {
    name: 'start_game',
    description: 'Start a game of Lantern Grid and open its interactive view. '
      + 'Once the view is open, the game itself is played with the tools the view exposes (look, move, ...).',
    inputSchema: {
      type: 'object',
      properties: { size: { type: 'integer', minimum: 3, maximum: 9, default: 5, description: 'Grid width and height.' } },
    },
    _meta: { ui: { resourceUri: VIEW_URI }, 'ui/resourceUri': VIEW_URI },
  },
  {
    name: 'high_scores',
    description: 'Server-side: the best finishing move counts so far. Does not need the view.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
];

const scores = [];

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const text = (t, extra = {}) => ({ content: [{ type: 'text', text: t }], ...extra });

function callTool(name, args) {
  if (name === 'start_game') {
    const size = Math.min(9, Math.max(3, Number.isInteger(args?.size) ? args.size : 5));
    return text(`Lantern Grid ${size}x${size} is open. Use the view's tools (look, move, light_lantern) to play.`,
      { structuredContent: { size } });
  }
  if (name === 'high_scores') {
    const best = [...scores].sort((a, b) => a - b).slice(0, 5);
    return text(best.length ? `Best finishes (moves): ${best.join(', ')}` : 'No finished games yet.',
      { structuredContent: { best } });
  }
  return text(`Unknown tool: ${name}`, { isError: true });
}

async function handle(m) {
  const { id, method, params } = m;
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: params?.protocolVersion ?? '2025-11-25',
        capabilities: { tools: {}, resources: {}, extensions: { 'io.modelcontextprotocol/ui': {} } },
        serverInfo: { name: 'mcp-app-webmcp-demo', version: '0.1.0' },
      });
    case 'notifications/initialized': return null;
    case 'ping': return ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS });
    case 'tools/call': return ok(id, callTool(params?.name, params?.arguments));
    case 'resources/list':
      return ok(id, { resources: [{ uri: VIEW_URI, name: 'Lantern Grid', mimeType: VIEW_MIME }] });
    case 'resources/templates/list': return ok(id, { resourceTemplates: [] });
    case 'resources/read':
      if (params?.uri !== VIEW_URI) return err(id, -32002, `resource not found: ${params?.uri}`);
      return ok(id, { contents: [{
        uri: VIEW_URI, mimeType: VIEW_MIME, text: await readFile(VIEW_PATH, 'utf8'),
        _meta: { ui: { prefersBorder: true } },
      }] });
    default:
      return id === undefined ? null : err(id, -32601, `method not found: ${method}`);
  }
}

export function createDemoServer() {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url.split('?')[0] === '/view') {
      // The View on its own, for a plain browser tab. `?polyfill=1` adds a minimal document.modelContext.
      (async () => {
        let html = await readFile(VIEW_PATH, 'utf8');
        if (req.url.includes('polyfill=1')) html = html.replace('<script>', `<script>${await readFile(DEV_POLYFILL_PATH, 'utf8')}</script>
<script>`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      })().catch(() => res.writeHead(500).end());
      return;
    }
    if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(405, { Allow: 'POST' }).end(); return; }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', async () => {
      const send = (status, body) => (body === null
        ? res.writeHead(202).end()
        : res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)));
      let m;
      try { m = JSON.parse(raw); } catch { send(400, err(null, -32700, 'Parse error')); return; }
      try { send(200, await handle(m)); } catch (e) { send(200, err(m.id, -32603, String(e?.message || e))); }
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--port');
  const port = at >= 0 ? Number(process.argv[at + 1]) : 8787;
  createDemoServer().listen(port, '127.0.0.1', () => console.log(`MCP at http://127.0.0.1:${port}/mcp`));
}

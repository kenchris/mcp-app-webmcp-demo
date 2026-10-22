import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoServer, VIEW_URI } from '../src/server.mjs';

let server, url;
test.before(async () => {
  server = createDemoServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/mcp`;
});
test.after(() => server.close());

let nextId = 0;
const call = async (method, params) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }) });
  return res.json();
};

test('initialize advertises tools, resources and the ui extension', async () => {
  const { result } = await call('initialize', { protocolVersion: '2025-11-25' });
  assert.ok(result.capabilities.tools && result.capabilities.resources);
  assert.ok(result.capabilities.extensions['io.modelcontextprotocol/ui']);
});

test('start_game links the view through _meta.ui.resourceUri', async () => {
  const { result } = await call('tools/list');
  const start = result.tools.find((t) => t.name === 'start_game');
  assert.equal(start._meta.ui.resourceUri, VIEW_URI);
  assert.equal(result.tools.find((t) => t.name === 'high_scores').annotations.readOnlyHint, true);
});

test('start_game clamps size and returns it as structuredContent', async () => {
  const { result } = await call('tools/call', { name: 'start_game', arguments: { size: 99 } });
  assert.equal(result.structuredContent.size, 9);
});

test('the view is served as an MCP App resource and registers its tools with WebMCP', async () => {
  const { result } = await call('resources/read', { uri: VIEW_URI });
  const [c] = result.contents;
  assert.equal(c.mimeType, 'text/html;profile=mcp-app');
  assert.match(c.text, /document\.modelContext/);
  for (const name of ['look', 'move', 'light_lantern', 'count_lit', 'explode', 'new_game']) {
    assert.match(c.text, new RegExp(String.raw`\b${name}:`), name);
  }
});

test('unknown resource and method fail cleanly', async () => {
  assert.equal((await call('resources/read', { uri: 'ui://nope' })).error.code, -32002);
  assert.equal((await call('nope')).error.code, -32601);
});

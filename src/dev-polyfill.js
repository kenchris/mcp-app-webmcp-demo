// SPDX-License-Identifier: Apache-2.0
// Minimal document.modelContext registry for opening the view in a plain browser tab (no host).
// Not the polyfill any host should ship: it exists so the view can be exercised standalone.
(function (doc) {
  if (doc.modelContext) return;
  const registry = new Map();
  const mc = new EventTarget();
  mc.registerTool = async (tool, { signal } = {}) => {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) throw new DOMException('Invalid tool name', 'InvalidStateError');
    if (registry.has(tool.name)) throw new DOMException('Duplicate tool name', 'InvalidStateError');
    registry.set(tool.name, tool);
    signal?.addEventListener('abort', () => { registry.delete(tool.name); mc.dispatchEvent(new Event('toolchange')); });
    mc.dispatchEvent(new Event('toolchange'));
  };
  mc.getTools = async () => [...registry.values()].map(({ execute, ...d }) => ({ ...d, inputSchema: JSON.stringify(d.inputSchema ?? {}) }));
  mc.executeTool = async (tool, input = {}) => {
    const t = registry.get(tool.name);
    if (!t) throw new DOMException('Unknown tool', 'InvalidStateError');
    return JSON.stringify(await t.execute(typeof input === 'string' ? JSON.parse(input) : input, { signal: new AbortController().signal }));
  };
  Object.defineProperty(doc, 'modelContext', { value: mc, configurable: true });
})(document);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTabList, chooseWorkTab, tabDrift, classifyTabListFailure } from '../src/runtime/cli-browser.ts';

test('parseTabList reads markdown tab headers', () => {
  const out = '- 0: (current) [Welcome](chrome-extension://x/connect.html)\n- 1: [Cardmarket](https://www.cardmarket.com/en/Magic)';
  const tabs = parseTabList(out);
  assert.equal(tabs.length, 2);
  assert.deepEqual(tabs[0]!, {index: 0, title: 'Welcome', url: 'chrome-extension://x/connect.html'});
  assert.deepEqual(tabs[1]!, {index: 1, title: 'Cardmarket', url: 'https://www.cardmarket.com/en/Magic'});
});

test('parseTabList reads JSON array output', () => {
  const out = JSON.stringify([{index: 0, url: 'https://www.cardmarket.com/en', title: 'Home'}, {index: 1, url: 'about:blank', title: ''}]);
  const tabs = parseTabList(out);
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0]!.url, 'https://www.cardmarket.com/en');
  assert.equal(tabs[1]!.url, 'about:blank');
});

test('parseTabList reads JSON wrapper around markdown', () => {
  const out = JSON.stringify({result: '- 0: (current) [Cardmarket](https://www.cardmarket.com/en/Magic)'});
  const tabs = parseTabList(out);
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0]!.url, 'https://www.cardmarket.com/en/Magic');
});

test('parseTabList keeps empty list for no open tabs', () => {
  assert.deepEqual(parseTabList('No open tabs. Navigate to a URL to create one.'), []);
});

test('parseTabList rejects unknown protocol output', () => {
  assert.throws(() => parseTabList('unexpected output'), {code: 'CLI_PROTOCOL'});
  assert.throws(() => parseTabList('not json'), {code: 'CLI_PROTOCOL'});
  assert.throws(() => parseTabList('{"other": true}'), {code: 'CLI_PROTOCOL'});
});

test('chooseWorkTab prefers cardmarket, then any non-extension tab; extension-only yields none', () => {
  const mk = (url: string, index: number) => ({index, url, title: ''});
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('https://www.cardmarket.com/en', 1)])!.index, 1);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('about:blank', 1)])!.index, 1);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('chrome-extension://y/b', 1)]), undefined);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0)]), undefined);
  assert.equal(chooseWorkTab([]), undefined);
});

test('tabDrift detects tab group composition changes', () => {
  const mk = (index: number, url: string, title: string) => ({index, url, title});
  const a = [mk(0, 'chrome-extension://x/a', 'Welcome'), mk(1, 'https://www.cardmarket.com/en/Magic', 'Cardmarket')];
  assert.equal(tabDrift(a, a.map(tab => ({...tab}))), false);
  assert.equal(tabDrift(a, [a[0]!]), true);
  assert.equal(tabDrift(a, [a[0]!, mk(1, 'https://www.cardmarket.com/en', 'Cardmarket')]), true);
  assert.equal(tabDrift(a, [a[0]!, mk(1, 'https://www.cardmarket.com/en/Magic', 'Cards')]), true);
  assert.equal(tabDrift(a, [a[0]!, a[1]!, mk(2, 'about:blank', '')]), true);
});

test('classifyTabListFailure maps transport failures', () => {
  assert.equal(classifyTabListFailure('Browser is not open.', false), 'not-open');
  assert.equal(classifyTabListFailure('Target closed', false), 'relay-dead');
  assert.equal(classifyTabListFailure('WebSocket disconnected', false), 'relay-dead');
  assert.equal(classifyTabListFailure('Page error', false), 'relay-dead');
  assert.equal(classifyTabListFailure('connection closed', false), 'relay-dead');
  assert.equal(classifyTabListFailure('socket hang up', false), 'relay-dead');
  assert.equal(classifyTabListFailure('protocol error', false), 'protocol');
  assert.equal(classifyTabListFailure('Unexpected token', false), 'protocol');
  assert.equal(classifyTabListFailure('SyntaxError', false), 'protocol');
  assert.equal(classifyTabListFailure('something else', false), 'unknown');
  assert.equal(classifyTabListFailure('anything', true), 'relay-dead');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTabList, chooseWorkTab } from '../src/runtime/cli-browser.ts';

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

test('chooseWorkTab prefers cardmarket, then any non-extension tab, then first tab', () => {
  const mk = (url: string, index: number) => ({index, url, title: ''});
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('https://www.cardmarket.com/en', 1)])!.index, 1);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('about:blank', 1)])!.index, 1);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0), mk('chrome-extension://y/b', 1)])!.index, 0);
  assert.equal(chooseWorkTab([mk('chrome-extension://x/a', 0)])!.index, 0);
  assert.equal(chooseWorkTab([]), undefined);
});

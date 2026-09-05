import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { uniqueVisible, clickUnique, allowedURL } from '../src/runtime/guards.ts';
import { AutomationError } from '../src/runtime/errors.ts';

async function browserTest(job:(page:Page)=>Promise<void>):Promise<void>{
  const browser=await chromium.launch({headless:true,
    ...(process.env.SITE_EXECUTABLE_PATH?{executablePath:process.env.SITE_EXECUTABLE_PATH}:{})});
  try {await job(await browser.newPage());} finally {await browser.close();}
}
test('a stable unique test ID is accepted',()=>browserTest(async page=>{
  await page.setContent('<button data-testid="save">Save</button>');
  await clickUnique(page.getByTestId('save'),'save',1000);
}));
test('duplicate test IDs fail closed instead of selecting the first',()=>browserTest(async page=>{
  await page.setContent('<button data-testid="save">A</button><button data-testid="save">B</button>');
  await assert.rejects(()=>uniqueVisible(page.getByTestId('save'),'save',300),
    (e:unknown)=>e instanceof AutomationError && e.code==='AMBIGUOUS_SELECTOR');
}));
test('absent target is reported as UI drift',()=>browserTest(async page=>{
  await page.setContent('<main>Empty</main>');
  await assert.rejects(()=>uniqueVisible(page.getByTestId('missing'),'missing',100),
    (e:unknown)=>e instanceof AutomationError && e.code==='UI_DRIFT');
}));
test('delayed rendering is waited for without a sleep in the workflow',()=>browserTest(async page=>{
  await page.setContent('<main></main><script>setTimeout(()=>{document.querySelector("main").innerHTML="<button data-testid=late>Ready</button>"},60)</script>');
  await clickUnique(page.getByTestId('late'),'late',2000);
}));
test('semantic scoping selects the intended row, not an identical button elsewhere',()=>browserTest(async page=>{
  await page.setContent('<section data-testid="item-41"><button>Edit</button></section><section data-testid="item-42"><button>Edit</button></section>');
  const target=page.getByTestId('item-42').getByRole('button',{name:'Edit',exact:true});
  await clickUnique(target,'item-42-edit',1000);
}));
test('origin validation rejects credentials and lookalike external origins',()=>{
  assert.equal(allowedURL('https://example.org/items',['https://example.org']),'https://example.org/items');
  for(const url of ['https://example.org.evil.test','https://evil.test','https://u:p@example.org','javascript:alert(1)'])
    assert.throws(()=>allowedURL(url,['https://example.org']),AutomationError);
});

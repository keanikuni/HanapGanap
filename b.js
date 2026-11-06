const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ acceptDownloads: true });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  // good case
  await p.goto('http://localhost:8125/pdf-tool.html'); await p.waitForTimeout(500); console.log('good load :', await p.textContent('#msg'));
  await p.click('#genBtn'); console.log('empty name:', await p.textContent('#msg'));
  await p.fill('#name', 'Ana Reyes');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#genBtn')]); console.log('download  :', dl.suggestedFilename(), '|', await p.textContent('#msg'));
  // wrong-server case (static server on another port, like Live Server)
  await p.goto('http://localhost:8126/pdf-tool.html'); await p.waitForTimeout(500); console.log('wrong srv :', (await p.textContent('#msg')).split('\n')[0]);
  await p.fill('#name', 'Ana'); await p.click('#genBtn'); await p.waitForTimeout(500); console.log('wrong click:', (await p.textContent('#msg')).slice(0, 110));
  await b.close();
})();

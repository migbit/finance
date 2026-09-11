// Local, synthetic-data check-in preview. Never connects to Firebase.
// Run: node tests/boletim-preview.mjs, then open http://localhost:4173/modules/boletim.html?t=test
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const guests=[];
let closed=false;
let writes=[];
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/js/script.js' || pathname === '/fixture-admin-sdk.js') {
    response.writeHead(200, { 'Content-Type':'text/javascript' });
    response.end(await readFile(resolve(root,'tests/boletim-admin-sdk.js')));
    return;
  }
  if (pathname === '/api/guest-registration' && request.method === 'POST') {
    let raw=''; for await (const chunk of request) raw+=chunk;
    const body=JSON.parse(raw);
    if (body.action === 'save' && !closed) {
      const existing=guests.find(guest=>guest.id===body.guestId);
      if (existing && body.editing) Object.assign(existing,body.data);
      else if (!existing) guests.push({id:body.guestId,...body.data,editable:true,submittedAt:Date.now()});
      closed=guests.length>=2;
      writes.push(body);
    }
    response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    response.end(JSON.stringify(closed ? {closed:true,language:'pt'} : {closed:false,language:'pt',expectedGuests:2,propertyId:'123',checkinDate:body.token === 'flex' ? '' : '2026-09-11',checkoutDate:body.token === 'test' ? '2026-09-20' : '',guests}));
    return;
  }
  const path = resolve(root, '.' + decodeURIComponent(pathname));
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    let content = await readFile(path);
    if (pathname === '/js/boletins.js') content=content.toString().replaceAll(/https:\/\/www\.gstatic\.com\/firebasejs\/[^']+/g, '/fixture-admin-sdk.js').replace("'./script.js'", "'/fixture-admin-sdk.js'");

    if (pathname === '/modules/boletim.html' || pathname === '/modules/boletins.html') {
      content = content.toString().replace('<main>', '<aside style="padding:8px;background:#fff4cc">TESTE LOCAL — dados fictícios.</aside><main>');
    }
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon' })[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404).end(); }
}).listen(4173, '127.0.0.1', () => console.log('Synthetic check-in preview: http://127.0.0.1:4173/modules/boletim.html?t=test'));

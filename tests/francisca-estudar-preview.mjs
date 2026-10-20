// Pré-visualização com uma conta fictícia. Não liga à autenticação nem a dados reais.
// Este ficheiro está excluído do alojamento por firebase.json.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve(import.meta.dirname,'..');
createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/mobile') {res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Estudar · verificação a 390 px</title><body style="margin:0;background:#444"><iframe title="Estudar no telemóvel" src="/modules/francisca-estudar.html" style="display:block;width:390px;height:844px;border:0;margin:auto"></iframe>');return;}
  if(pathname==='/js/script.js') {res.writeHead(200,{'Content-Type':'text/javascript'});res.end('export async function whenAccessResolved(){return {user:{uid:"study-preview"},mode:"write"};}');return;}
  const path=resolve(root,'.'+decodeURIComponent(pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try {const content=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.ico':'image/x-icon','.json':'application/json'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);}catch {res.writeHead(404).end();}
}).listen(4178,'127.0.0.1',()=>console.log('Study preview: http://127.0.0.1:4178/modules/francisca-estudar.html'));

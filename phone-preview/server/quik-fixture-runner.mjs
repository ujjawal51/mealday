// Tiny test server for the four sandbox tools used by Mealday. Not the full Careem sandbox.
// Uses the original fixtures read from a download passed by the developer, never any Careem backend.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const toolFiles={
  is_grocery_area_serviceable:'groceries',
  search_groceries_items:'groceries',
  create_grocery_cart_with_quantities:'groceries',
  cart_get_basket_price:'cart',
};
export async function startQuikFixtures(specDir,port=0){
  const definitions=Object.fromEntries(await Promise.all(Object.entries(toolFiles).map(async ([name,domain])=>{
    const raw=await readFile(resolve(specDir,'tools',domain,name+'.md'),'utf8');
    return [name,{definition:JSON.parse(raw.match(/```json tool\r?\n([\s\S]+?)\r?\n```/)[1]),
      scenarios:Object.fromEntries([...raw.matchAll(/## Scenario: ([\w-]+)\r?\n([\s\S]*?)(?=\r?\n## |$)/g)].map(([,id,body])=>[id,body.match(/```json response\r?\n([\s\S]+?)\r?\n```/)[1]]))}];
  })));
  const calls=[],sessions=new Set();
  const server=createServer(async(req,res)=>{
    const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type});res.end(value===undefined?'':JSON.stringify(value));};
    if(req.url!=='/mcp')return send(404);
    const session=req.headers['mcp-session-id'];
    if(req.method==='DELETE'){sessions.delete(session);return send(204);}
    if(req.method!=='POST')return send(405);
    try{
      let raw='';for await(const c of req){raw+=c;if(raw.length>65536)return send(413);}
      const {method,id,params}=JSON.parse(raw);
      const result=value=>send(200,{jsonrpc:'2.0',id,result:value});
      if(method==='initialize'){
        const id=randomUUID();sessions.add(id);res.setHeader('Mcp-Session-Id',id);
        return result({protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'careem-mcp-service',version:'v1.0.0'}});
      }
      if(!sessions.has(session))return send(404);
      if(method==='notifications/initialized')return send(202);
      if(method==='tools/list')return result({tools:Object.values(definitions).map(x=>x.definition)});
      const tool=definitions[params?.name],a=params?.arguments;
      if(method!=='tools/call'||!tool||!a)return send(400);
      const required=tool.definition.inputSchema.required;
      if(required.some(k=>!Object.hasOwn(a,k))||Object.keys(a).some(k=>!Object.hasOwn(tool.definition.inputSchema.properties,k)))return send(400);
      calls.push({name:params.name,arguments:a});
      const idFor={
        is_grocery_area_serviceable:()=>a.latitude===51.5074?'not-serviceable':'serviceable',
        search_groceries_items:()=>{
          const terms=a.search_terms;
          if(terms.some(t=>t.includes('unicorn')))return terms.some(t=>t.includes('milk'))?'partial-results':'no-results';
          if(terms.join(',')==='milk,eggs,bread')return 'breakfast-trio';
          return ['milk','eggs','bread'].find(t=>terms[0]===t)||'generic-results';
        },
        create_grocery_cart_with_quantities:()=>'breakfast-cart',
        cart_get_basket_price:()=>'grocery-price',
      };
      const v=JSON.parse(tool.scenarios[idFor[params.name]()].replaceAll('{{uuid}}',randomUUID()).replaceAll('{{args.search_terms.0}}',()=>JSON.stringify(a.search_terms?.[0]||'').slice(1,-1)));
      // Exercise both MCP JSON and streamed event formats.
      const json=JSON.stringify({jsonrpc:'2.0',id,result:{structuredContent:v,content:[{type:'text',text:JSON.stringify(v)}],isError:false}});
      res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('event: message\ndata: '+json+'\n\n');
    }catch{return send(400);}
  });
  server.listen(port,'127.0.0.1');await once(server,'listening');
  return {server,calls,url:'http://127.0.0.1:'+server.address().port+'/mcp'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('Pass the unzipped Careem sandbox spec directory.');
  const fixture=await startQuikFixtures(process.argv[2],8787);
  console.log('Fixture-only Quik MCP listening on '+fixture.url);
}

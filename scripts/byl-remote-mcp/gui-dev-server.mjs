import {createServer} from 'node:http';
import {handleGuiRequest} from './gui-remote-handler.mjs';
export function createGuiDevServer({token,lookup}){
 if(typeof token!=='string'||token.length<32)throw Error('STRONG_TOKEN_REQUIRED');
 return createServer(async(req,res)=>{
  const reply=(code,obj)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj));};
  if(req.method!=='POST'||req.url!=='/dev/gui/inspect')return reply(404,{ok:false,errorCode:'NOT_FOUND'});
  if(req.headers.authorization!== 'Bearer '+token)return reply(401,{ok:false,errorCode:'UNAUTHORIZED'});
  let chunks=[],bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)return reply(413,{ok:false,errorCode:'BODY_TOO_LARGE'});chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(400,{ok:false,errorCode:'INVALID_JSON'});}
  if(input.action!=='inspect')return reply(403,{ok:false,errorCode:'INSPECT_ONLY'});
  const result=handleGuiRequest(input,{lookup});
  return reply(result.ok?200:403,result);
 });
}

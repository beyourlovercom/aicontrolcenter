import type {IncomingMessage,ServerResponse} from 'node:http';

export type PrNavigationApiDependencies={
  readSnapshot:()=>unknown|Promise<unknown>;
  refreshSnapshot:()=>unknown|Promise<unknown>;
  snapshotPath:()=>string;
};

const allowedOrigins=new Set(['http://127.0.0.1:1420','http://localhost:1420']);

function json(response:ServerResponse,body:unknown,status=200){
  response.statusCode=status;
  response.setHeader('Content-Type','application/json');
  response.end(JSON.stringify(body));
}

export function createPrNavigationApiHandler(dependencies:PrNavigationApiDependencies){
  return (request:IncomingMessage,response:ServerResponse)=>{
    if(request.method==='GET')return void Promise.resolve().then(()=>dependencies.readSnapshot()).then(snapshot=>json(response,{snapshot,snapshotPath:dependencies.snapshotPath(),authority:0})).catch(error=>json(response,{error:error instanceof Error?error.message:'PR_NAVIGATION_READ_FAILED'},503));
    if(request.method!=='POST')return json(response,{error:'METHOD_NOT_ALLOWED'},405);
    const origin=request.headers.origin;
    if(!origin||!allowedOrigins.has(origin))return json(response,{error:'ORIGIN_REJECTED'},403);
    if(request.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')return json(response,{error:'JSON_REQUIRED'},415);
    let body='';
    request.on('data',chunk=>body+=chunk);
    request.on('end',()=>{
      if(!body.trim())return json(response,{error:'REFRESH_PR_BODY_REQUIRED'},400);
      let payload:unknown;
      try{payload=JSON.parse(body)}catch{return json(response,{error:'REFRESH_PR_PAYLOAD_INVALID'},400)}
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length)return json(response,{error:'REFRESH_PR_PAYLOAD_NOT_ALLOWED'},400);
      Promise.resolve().then(()=>dependencies.refreshSnapshot()).then(snapshot=>json(response,{snapshot,snapshotPath:dependencies.snapshotPath(),authority:0})).catch(error=>json(response,{error:error instanceof Error?error.message:'PR_NAVIGATION_REFRESH_FAILED'},409));
    });
  };
}

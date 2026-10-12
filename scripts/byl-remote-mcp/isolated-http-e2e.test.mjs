import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash, generateKeyPairSync, randomBytes, sign, verify} from 'node:crypto';

// Fully isolated end-to-end HTTP transport test with throwaway keys.
// Does not use a production Gateway/Agent or real secret files.
const hash = body => createHash('sha256').update(body).digest('hex');
const canonical = (method,path,ts,body) => Buffer.from([method,path,ts,hash(body)].join('\n'));
test('isolated HTTP Ed25519 valid/invalid requests and read-only tools', async () => {
  const keys=generateKeyPairSync('ed25519');
  const token=randomBytes(32).toString('hex');
  const agent=createServer((req,res)=>{
    const chunks=[];
    req.on('data',part=>chunks.push(part));
    req.on('end',()=>{
      const body=Buffer.concat(chunks);
      const ts=req.headers['x-byl-timestamp'];
      const b64=req.headers['x-byl-signature'];
      const fresh=typeof ts==='string' && /^\d+$/.test(ts) && Math.abs(Date.now()-Number(ts))<=60000;
      const ok=fresh && typeof b64==='string' && verify(null,canonical(req.method,req.url,ts,body),keys.publicKey,Buffer.from(b64,'base64'));
      res.setHeader('content-type','application/json');
      res.statusCode=ok?200:401;
      res.end(JSON.stringify(ok?{tools:[{name:'read_file'},{name:'get_config'}]}:{errorCode:'DC_AGENT_SIGNATURE_INVALID'}));
    });
  });
  const gateway=createServer(async (req,res)=>{
    const allowed=req.headers.authorization==='Bearer '+token;
    if(!allowed){res.writeHead(401);res.end();return;}
    const ts=String(Date.now());
    const body=Buffer.alloc(0);
    const signature=sign(null,canonical('GET','/v1/tools',ts,body),keys.privateKey).toString('base64');
    const target=new URL('/v1/tools',agent.addressUrl);
    const remote=await fetch(target,{headers:{'x-byl-timestamp':ts,'x-byl-signature':signature}});
    res.writeHead(remote.status,{'content-type':'application/json'});
    res.end(await remote.text());
  });
  await new Promise(resolve=>agent.listen(0,'127.0.0.1',resolve));
  agent.addressUrl='http://127.0.0.1:'+agent.address().port;
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+gateway.address().port;
  try {
    const good=await fetch(base+'/tools',{headers:{authorization:'Bearer '+token}});
    assert.equal(good.status,200);
    assert.equal((await good.json()).tools.length,2);
    const unauthorized=await fetch(base+'/tools');
    assert.equal(unauthorized.status,401);
    const unsigned=await fetch(agent.addressUrl+'/v1/tools');
    assert.equal(unsigned.status,401);
    assert.equal((await unsigned.json()).errorCode,'DC_AGENT_SIGNATURE_INVALID');
  } finally {
    await Promise.all([new Promise(resolve=>gateway.close(resolve)),new Promise(resolve=>agent.close(resolve))]);
  }
});

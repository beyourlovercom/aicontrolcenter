const PROVIDER='chatgpt-web';
const MAX_MESSAGES=120;
const MAX_TEXT_CHARS=6000;

function fail(code){const error=new Error(code);error.code=code;throw error;}
function requiredText(value,code,max=500){if(typeof value!=='string'||!value.trim())fail(code);return value.trim().slice(0,max);}

export function conversationIdentity(value){
  let url;try{url=new URL(value);}catch{fail('CHATGPT_SNAPSHOT_URL_INVALID');}
  if(url.protocol!=='https:'||url.hostname!=='chatgpt.com')fail('CHATGPT_SNAPSHOT_URL_INVALID');
  const parts=url.pathname.split('/').filter(Boolean);const marker=parts.lastIndexOf('c');
  if(marker<0||!parts[marker+1])fail('CHATGPT_SNAPSHOT_CONVERSATION_INVALID');
  const conversationId=decodeURIComponent(parts[marker+1]);
  if(!conversationId||conversationId.includes('/')||/\s/.test(conversationId))fail('CHATGPT_SNAPSHOT_CONVERSATION_INVALID');
  return {conversationId,conversationUrl:`https://chatgpt.com/c/${encodeURIComponent(conversationId)}`};
}

export function normalizeChatgptSnapshot(input,now=()=>new Date().toISOString()){
  const identity=conversationIdentity(input?.conversationUrl||input?.url);
  if(input?.conversationId!==identity.conversationId)fail('CHATGPT_SNAPSHOT_CONVERSATION_MISMATCH');
  const rawMessages=Array.isArray(input?.messages)?input.messages:[];
  const messages=rawMessages.slice(-MAX_MESSAGES).map((message,index)=>{
    const role=message?.role;
    if(role!=='user'&&role!=='assistant')fail('CHATGPT_SNAPSHOT_ROLE_INVALID');
    return {
      messageId:typeof message?.messageId==='string'&&message.messageId.trim()?message.messageId.trim().slice(0,300):`${role}-${index}`,
      role,
      text:requiredText(message?.text,'CHATGPT_SNAPSHOT_TEXT_INVALID',MAX_TEXT_CHARS)
    };
  });
  return {
    provider:PROVIDER,
    conversationId:identity.conversationId,
    conversationUrl:identity.conversationUrl,
    title:typeof input?.title==='string'&&input.title.trim()?input.title.trim().slice(0,300):'ChatGPT Conversation',
    tabId:Number.isInteger(input?.tabId)?input.tabId:null,
    capturedAt:typeof input?.capturedAt==='string'&&input.capturedAt.trim()?input.capturedAt:now(),
    messages
  };
}

export function createChatgptProjectionStore(options={}){
  const snapshots=new Map();
  const now=options.now||(()=>new Date().toISOString());
  return {
    upsert(input){const snapshot=normalizeChatgptSnapshot(input,now);snapshots.set(snapshot.conversationId,snapshot);return snapshot;},
    get(conversationId){return snapshots.get(conversationId)||null;},
    list(){return [...snapshots.values()].sort((a,b)=>String(b.capturedAt).localeCompare(String(a.capturedAt)));},
    clear(){snapshots.clear();}
  };
}

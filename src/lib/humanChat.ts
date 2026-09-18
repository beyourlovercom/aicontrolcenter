import type { ExecutionRoomState } from './executionRoomState.ts';

export type HumanChatProjection={
  request:{requestId:string;roomId:string;conversationId:string;conversationUrl:string;content:string;createdAt:string};
  state:{requestId:string;state:'PENDING'|'CLAIMED'|'DELIVERED'|'ABORTED_BEFORE_SEND'|'UNCERTAIN';errorCode:string|null;updatedAt:string};
};

export async function submitHumanChat(room:ExecutionRoomState,content:string,fetcher:typeof fetch=fetch):Promise<HumanChatProjection>{
  const message=content.trim();
  if(!message)throw new Error('HUMAN_CHAT_EMPTY');
  if(!room.gptConversationBinding||!room.gptConversationUrl)throw new Error('HUMAN_CHAT_CONVERSATION_UNBOUND');
  const response=await fetcher('/api/chat/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomId:room.roomId,conversationId:room.gptConversationBinding,conversationUrl:room.gptConversationUrl,content:message})});
  const body=await response.json() as any;
  if(!response.ok)throw new Error(body?.errorCode||`HUMAN_CHAT_HTTP_${response.status}`);
  return {request:body.request,state:body.state};
}

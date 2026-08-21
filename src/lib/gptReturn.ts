import {readCanonicalResult,updateCanonicalResultReturn,type RuntimeState} from './runtimeManager.ts';
import type {CanonicalExecutionResult} from './model/entityTypes.ts';

export type GptReturnIdentity={projectId:string;repositoryIdentity:string;executionId:string;resultId:string;resultHash:string;originConversationId?:string;originMessageId?:string;originBlockId?:string};
export type GptReturnResponse={ok:boolean;state?:CanonicalExecutionResult['returnState'];result?:CanonicalExecutionResult;code?:string;reason?:string;alreadyReturned?:boolean;claimGranted?:boolean};

function sameOrigin(result:CanonicalExecutionResult,identity:GptReturnIdentity){
  return Boolean(identity.originConversationId&&result.originConversationId===identity.originConversationId&&(!identity.originMessageId||result.originMessageId===identity.originMessageId)&&(!identity.originBlockId||result.originBlockId===identity.originBlockId));
}
function resolve(identity:GptReturnIdentity):RuntimeState|null{
  const state=readCanonicalResult(identity.executionId);
  if(!state?.canonicalResult)return null;
  const result=state.canonicalResult;
  if(state.projectId!==identity.projectId||state.repositoryIdentity!==identity.repositoryIdentity||result.projectId!==identity.projectId||result.repositoryIdentity!==identity.repositoryIdentity)return null;
  if(result.resultId!==identity.resultId||result.resultHash!==identity.resultHash)return null;
  return state;
}
export function buildGptReturnEnvelope(result:CanonicalExecutionResult):string{
  return result.rawResult;
}
export function claimGptReturn(identity:GptReturnIdentity):GptReturnResponse{
  const state=resolve(identity);
  if(!state?.canonicalResult)return {ok:false,code:'CANONICAL_RESULT_UNAVAILABLE',reason:'Canonical result is unavailable for this execution.'};
  const result=state.canonicalResult;
  if(!sameOrigin(result,identity))return {ok:false,code:'EXACT_ORIGIN_UNAVAILABLE',reason:'The exact originating ChatGPT conversation is unavailable.'};
  if(result.returnState==='RETURNED_TO_GPT'||result.returnState==='CLOSED')return {ok:true,state:result.returnState,result,alreadyReturned:true,claimGranted:false};
  if(result.returnState==='RETURN_SUBMITTING')return {ok:true,state:result.returnState,result,claimGranted:false};
  if(result.returnState==='DELIVERY_FAILED')return {ok:false,state:result.returnState,result,code:'GPT_RETURN_DELIVERY_FAILED',reason:result.returnFailure||'The previous return operation failed and requires explicit recovery.'};
  const updated=updateCanonicalResultReturn(identity.executionId,{returnState:'RETURN_SUBMITTING',returnAttemptedAt:new Date().toISOString(),returnFailure:undefined});
  return updated?.canonicalResult?{ok:true,state:updated.canonicalResult.returnState,result:updated.canonicalResult,claimGranted:true}:{ok:false,code:'RETURN_STATE_PERSISTENCE_FAILED',reason:'Unable to persist return state.'};
}
export function completeGptReturn(identity:GptReturnIdentity):GptReturnResponse{
  const state=resolve(identity);
  if(!state?.canonicalResult)return {ok:false,code:'CANONICAL_RESULT_UNAVAILABLE',reason:'Canonical result is unavailable for this execution.'};
  if(!sameOrigin(state.canonicalResult,identity))return {ok:false,code:'EXACT_ORIGIN_UNAVAILABLE',reason:'The exact originating ChatGPT conversation is unavailable.'};
  if(state.canonicalResult.returnState==='RETURNED_TO_GPT'||state.canonicalResult.returnState==='CLOSED')return {ok:true,state:state.canonicalResult.returnState,result:state.canonicalResult,alreadyReturned:true};
  const updated=updateCanonicalResultReturn(identity.executionId,{returnState:'RETURNED_TO_GPT',returnedAt:new Date().toISOString(),returnFailure:undefined});
  return updated?.canonicalResult?{ok:true,state:updated.canonicalResult.returnState,result:updated.canonicalResult}:{ok:false,code:'RETURN_STATE_PERSISTENCE_FAILED',reason:'Unable to persist returned state.'};
}
export function failGptReturn(identity:GptReturnIdentity,reason='GPT_RETURN_DELIVERY_FAILED'):GptReturnResponse{
  const state=resolve(identity);
  if(!state?.canonicalResult)return {ok:false,code:'CANONICAL_RESULT_UNAVAILABLE',reason:'Canonical result is unavailable for this execution.'};
  if(state.canonicalResult.returnState==='RETURNED_TO_GPT'||state.canonicalResult.returnState==='CLOSED')return {ok:true,state:state.canonicalResult.returnState,result:state.canonicalResult,alreadyReturned:true};
  const updated=updateCanonicalResultReturn(identity.executionId,{returnState:'DELIVERY_FAILED',returnFailure:reason});
  return updated?.canonicalResult?{ok:true,state:updated.canonicalResult.returnState,result:updated.canonicalResult}:{ok:false,code:'RETURN_STATE_PERSISTENCE_FAILED',reason:'Unable to persist return failure.'};
}

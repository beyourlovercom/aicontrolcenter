const hasOwn= (value,key)=>Object.prototype.hasOwnProperty.call(value,key);

function record(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}

/**
 * Normalize an already-authorized legacy remote call without widening it.
 * This helper is pure: it only clones arguments when it adds the default.
 */
export function normalizeApprovedRemoteCall(approved){
 if(!record(approved)||typeof approved.name!=='string'||!record(approved.arguments))
  throw Error('PARITY_APPROVED_CALL_INVALID');
 if(approved.name!=='start_process')return approved;
 const args=approved.arguments;
 if(hasOwn(args,'timeout_ms')){
  if(!Number.isSafeInteger(args.timeout_ms)||args.timeout_ms<0)
   throw Error('PARITY_TIMEOUT_INVALID');
  return approved;
 }
 return {...approved,arguments:{...args,timeout_ms:3000}};
}

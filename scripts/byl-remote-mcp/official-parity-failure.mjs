/**
 * Stable, redacted failure categories for DC Official Parity V1.
 * Classifies ONLY an error observed by an authorized tool handler.
 * A platform-side refusal that prevents tool invocation cannot be detected
 * here and must be reported by the host; never infer one from missing output.
 */
const CODES=Object.freeze({
 OPERATOR_DENIED:['AUTHORIZATION','none'],
 OPERATOR_DEVICE_DENIED:['AUTHORIZATION','none'],
 OPERATOR_TOOL_DENIED:['AUTHORIZATION','none'],
 OPERATOR_ARGUMENTS_DENIED:['ARGUMENTS','none'],
 UNREGISTERED_DEVICE:['DEVICE','none'],
 AUTH_FAILED:['AUTHENTICATION','none'],
 CHALLENGE_EXPIRED:['AUTHENTICATION','retry-read'],
 TIMEOUT:['TRANSPORT','retry-read'],
 UNREACHABLE:['TRANSPORT','retry-read'],
 AGENT_DEGRADED:['DEVICE','retry-read'],
 MALFORMED_RESPONSE:['RESPONSE','none'],
 PARITY_RESPONSE_INVALID:['RESPONSE','none']
});
function errorCode(input){
 const raw=typeof input==='string'?input:input?.code||input?.message;
 return typeof raw==='string'&&Object.hasOwn(CODES,raw)?raw:'PARITY_UNKNOWN_ERROR';
}
export function classifyParityFailure(error,{operation='read'}={}){
 const code=errorCode(error);
 const match=CODES[code];
 const kind=match?.[0]||'UNKNOWN';
 // Retry hints apply only to read-only operations; UNKNOWN never auto-retries.
 const retryable=operation==='read'&&match?.[1]==='retry-read';
 return Object.freeze({code,kind,retryable,certainty:'reported',outcome:'NOT_CONFIRMED'});
}

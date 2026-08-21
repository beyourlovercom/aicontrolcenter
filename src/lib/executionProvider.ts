export type ExecutionProviderSandbox='workspace-write'|'read-only';
export type ExecutionProviderStatus='ACCEPTED'|'STARTING'|'RUNNING'|'COMPLETED'|'FAILED'|'CANCELLED';
export type ExecutionProviderContext={execution_id:string;instruction_id?:string;repository:string;branch:string;worktree_path:string;sandbox:ExecutionProviderSandbox;execution_type:string;spec_file?:string;supervisor_script?:string};
export type ExecutionProviderResult={execution_id:string;provider_id:string;status:ExecutionProviderStatus;stdout:string;stderr:string;result_payload:unknown;completed_at:string|null};
export type ExecutionProviderErrorCode='PROVIDER_UNAVAILABLE'|'INVALID_CONTEXT'|'EXECUTION_FAILED'|'TIMEOUT'|'PROVIDER_NOT_FOUND'|'PROVIDER_DISABLED'|'CAPABILITY_NOT_SUPPORTED';
export type ExecutionProviderError={code:ExecutionProviderErrorCode;message:string;cause?:unknown};
export type ExecutionProviderCapabilities={streaming:boolean;cancellation:boolean;structuredResults:boolean};
export type ExecutionProviderStart={execution_id:string;provider_id:string;status:'STARTING'|'FAILED';process_id:number|null;error?:ExecutionProviderError};
export interface ExecutionProvider{
  readonly providerId:string;
  readonly capabilities:ExecutionProviderCapabilities;
  validateExecution(context:ExecutionProviderContext):ExecutionProviderError|null;
  startExecution(context:ExecutionProviderContext):ExecutionProviderStart;
  getExecutionStatus(context:ExecutionProviderContext):ExecutionProviderStatus;
  cancelExecution(context:ExecutionProviderContext):ExecutionProviderError|null;
  collectResult(context:ExecutionProviderContext):ExecutionProviderResult;
}
export function normalizeProviderError(error:unknown, fallback:ExecutionProviderErrorCode='EXECUTION_FAILED'):ExecutionProviderError{
  if(error&&typeof error==='object'&&'code' in error&&['PROVIDER_UNAVAILABLE','INVALID_CONTEXT','EXECUTION_FAILED','TIMEOUT'].includes(String((error as {code?:unknown}).code)))return {code:(error as {code:ExecutionProviderErrorCode}).code,message:String((error as {message?:unknown}).message??(error as {code:string}).code)};
  return {code:fallback,message:error instanceof Error?error.message:fallback,cause:error};
}

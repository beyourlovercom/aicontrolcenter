export type RuntimeLifecycleMetrics={appMountCount:number;workspaceMountCount:number;fullPageRefreshCount:number};
let metrics:RuntimeLifecycleMetrics={appMountCount:0,workspaceMountCount:0,fullPageRefreshCount:0};
export function resetRuntimeLifecycleMetrics(){metrics={appMountCount:0,workspaceMountCount:0,fullPageRefreshCount:0};}
export function recordAppMount(){metrics.appMountCount+=1;}
export function recordWorkspaceMount(){metrics.workspaceMountCount+=1;}
export function recordFullPageRefresh(){metrics.fullPageRefreshCount+=1;}
export function readRuntimeLifecycleMetrics():RuntimeLifecycleMetrics{return {...metrics};}

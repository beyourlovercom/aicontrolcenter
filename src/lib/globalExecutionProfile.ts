export type GlobalExecutionProfile={model:string;reasoning:string;updatedAt:string};

let currentProfile:GlobalExecutionProfile|null=null;

export function setGlobalExecutionProfile(profile:GlobalExecutionProfile):GlobalExecutionProfile{
  currentProfile={...profile};
  return currentProfile;
}

export function readGlobalExecutionProfile():GlobalExecutionProfile|null{
  return currentProfile?{...currentProfile}:null;
}

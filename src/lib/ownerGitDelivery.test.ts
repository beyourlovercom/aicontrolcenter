import assert from 'node:assert/strict';
import {OWNER_AUTHORIZED_GIT_DELIVERY, OWNER_GIT_DELIVERY_PROFILE} from './ownerGitDelivery.ts';
assert.equal(OWNER_AUTHORIZED_GIT_DELIVERY, 'OWNER_AUTHORIZED_GIT_DELIVERY');
assert.deepEqual(OWNER_GIT_DELIVERY_PROFILE, {name:'OWNER_AUTHORIZED_GIT_DELIVERY',gitMetadataWrite:1,networkAccess:1,httpsGithub:1,requiresSsh22:0,requiresExplicitOwnerAction:1,executionOwner:'CODEX'});
console.log('owner Git delivery profile tests passed');

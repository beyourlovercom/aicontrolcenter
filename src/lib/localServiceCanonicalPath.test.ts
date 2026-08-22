import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const source=readFileSync(join(process.cwd(),'scripts/aicc-local-service-supervisor.sh'),'utf8');
assert.match(source,/CANONICAL_REPOSITORY_ROOT="\$\(\/bin\/realpath/,'configured repository root is filesystem-canonicalized');
assert.match(source,/CHECK_CWD_CANONICAL="\$\(\/bin\/realpath/,'candidate process cwd is filesystem-canonicalized');
assert.match(source,/\[ "\$CHECK_CWD_CANONICAL" = "\$CANONICAL_REPOSITORY_ROOT" \]/,'PID ownership compares canonical filesystem paths');
assert.match(source,/node_modules\/.bin\/vite\|vite /,'PID ownership still requires canonical Vite command evidence');
console.log('Local service canonical path identity matrix passed');

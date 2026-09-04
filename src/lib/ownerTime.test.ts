import assert from 'node:assert/strict';
import {formatOwnerLocalTime,OWNER_TIME_FALLBACK} from './ownerTime.ts';

const timestamp='2026-08-13T04:03:00.000Z';
const date=new Date(timestamp);
const expected=`${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
assert.equal(formatOwnerLocalTime(timestamp),expected,'UTC ISO is converted to the browser local timezone');
assert.match(formatOwnerLocalTime('2026-01-02T03:04:05.678Z'),/^\d{2}-\d{2} \d{2}:\d{2}$/,'month/day and hour/minute are zero padded');
assert.equal(formatOwnerLocalTime(undefined),OWNER_TIME_FALLBACK,'missing timestamp has a truthful fallback');
assert.equal(formatOwnerLocalTime('not-a-timestamp'),OWNER_TIME_FALLBACK,'invalid timestamp has a truthful fallback');
console.log('owner local time formatter tests passed');

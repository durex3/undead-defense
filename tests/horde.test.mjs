import test from 'node:test';
import assert from 'node:assert/strict';
import {hordePressure} from '../temp/tests/battle/HordePressure.mjs';
test('horde density grows with developed weapons and time, stays capped and leaves opening unchanged',()=>{
 const strong={skills:{blade:4,fire:4,ice:4,lightning:4},evolutions:{blade:'ring',fire:'meteor'}};
 assert.deepEqual(hordePressure({...strong,time:20}),{extra:0,rate:1});
 assert.deepEqual(hordePressure({skills:{blade:1},evolutions:{},time:200}),{extra:0,rate:1.15});
 assert.deepEqual(hordePressure({...strong,time:80}),{extra:1,rate:1.22});
 assert.deepEqual(hordePressure({...strong,time:200}),{extra:4,rate:1.43});
});

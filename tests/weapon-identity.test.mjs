import test from "node:test";
import assert from "node:assert/strict";
import {SurvivalWorld} from "../temp/tests/battle/SurvivalWorld.mjs";
import {WEAPONS} from "../temp/tests/battle/SurvivalConfig.mjs";
import {weaponStats} from "../temp/tests/battle/ArmoryConfig.mjs";
import {upgradeChanges,weaponDetails} from "../temp/tests/battle/WeaponStatus.mjs";
const world=skill=>{const w=new SurvivalWorld(31,"ranger",1);for(const s of WEAPONS)w.skills[s]=s===skill?1:0;w.enemies=[];w.player={x:0,y:0};return w;};
const enemy=(w,x,y=0)=>{const e=w.addEnemy("minion",x,y);Object.assign(e,{hp:1e6,maxHp:1e6,state:"seek"});return e;};
const step=(w,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-8;t+=dt){const d=Math.min(dt,seconds-t);w.time+=d;w.armory.step(d);}};
const cast=w=>{w.armory.step(0);for(const s of WEAPONS)w.cooldowns[s]=100;};

test("base orbit follows player position and sweep never damages the empty centre",()=>{
  for(const dt of [1/60,1/30,.25]) {
    const w=world("blade"),edge=enemy(w,1.9),centre=enemy(w,0);cast(w);step(w,1.6,dt);
    assert.equal(centre.hp,centre.maxHp);assert.ok(edge.hp<edge.maxHp);
    assert.ok(w.armory.shots.every(p=>!p.active));
  }
  const w=world("blade");enemy(w,5);cast(w);w.player.x=3;step(w,.1);
  for(const p of w.armory.shots)assert.ok(Math.abs(Math.hypot(p.x-3,p.y)-1.9)<1e-6);
});

test("four real knives remain evenly spaced through cycle changes and upgrades",()=>{
  const w=world("blade");
  const check=count=>{const blades=w.armory.shots.filter(p=>p.active&&p.orbit);assert.equal(blades.length,count);
    const angles=blades.map(p=>Math.atan2(p.y-w.player.y,p.x-w.player.x)).sort((a,b)=>a-b);
    for(let i=1;i<count;i++)assert.ok(Math.abs(angles[i]-angles[i-1]-Math.PI*2/count)<1e-6);
  };
  w.armory.step(0);check(4);
  for(let i=0;i<110;i++){step(w,1/60);check(4);}
  w.skills.blade=3;step(w,1.7);check(5);
  w.skills.blade=6;step(w,1.7);check(6);
});

test("ice prepares before one explosion and does not damage late arrivals through old frost",()=>{
  const w=world("frost"),e=enemy(w,1);cast(w);assert.equal(e.hp,e.maxHp);
  step(w,.09);assert.equal(e.hp,e.maxHp);step(w,.02);assert.ok(e.hp<e.maxHp);
  assert.ok(e.freezeUntil-w.time>.7);
  const late=enemy(w,1);step(w,.35);assert.equal(late.hp,late.maxHp);
});

test("three frost sectors survive a large step without lost or duplicate damage",()=>{
  const totals=[];
  for(const dt of [1/60,.6]) {
    const w=world("frost");w.mods.frost=["sectors"];
    for(let i=0;i<3;i++)enemy(w,Math.cos(i*Math.PI*2/3)*2,Math.sin(i*Math.PI*2/3)*2);
    cast(w);step(w,.6,dt);totals.push(w.damage.frost);
  }
  assert.ok(totals[0]>0);assert.ok(Math.abs(totals[0]-totals[1])<1e-6);
});

test("ghosts perform exactly two contact claws then return, without generating new partners",()=>{
  const w=world("ghost"),e=enemy(w,2);cast(w);step(w,2);
  assert.ok(Math.abs(w.damage.ghost-weaponStats(w,"ghost").damage*4)<1e-6);
  assert.ok(w.armory.extra.attacks.every(a=>!a.active));assert.equal(w.armory.extra.attacks.length,2);
});

test("ghost quantity upgrades join the next task and the UI names companions and individual claws",()=>{
  const w=world("ghost");enemy(w,2);w.armory.step(0);assert.equal(w.armory.extra.ghostCount,2);
  w.skills.ghost=2;assert.match(upgradeChanges(w,"ghost"),/伙伴数 2 → 3/);
  assert.match(weaponDetails(w,"ghost"),/单爪伤害/);
  w.skills.ghost=3;step(w,.05);assert.equal(w.armory.extra.ghostCount,2);
  step(w,3.1);assert.equal(w.armory.extra.ghostCount,3);
  assert.ok(w.armory.extra.attacks.filter(a=>a.active&&a.skill==="ghost").length<=3);
  w.skills.ghost=8;w.passives.amount=2;w.mods.ghost=["swarm"];step(w,3.1);
  assert.equal(w.armory.extra.ghostCount,8);
});

test("ghosts reacquire dead targets once and never chase a second dead replacement forever",()=>{
  const w=world("ghost"),first=enemy(w,3),next=enemy(w,5);cast(w);first.hp=0;
  step(w,.01);const a=w.armory.extra.attacks.find(a=>a.targetId===next.id&&a.retargeted);
  assert.ok(a);next.hp=0;enemy(w,6);step(w,.01);assert.equal(a.phase,2);
  step(w,3);assert.ok(!a.active);
});

test("a fleeing target does not receive a phantom second claw",()=>{
  const w=world("ghost"),e=enemy(w,1);cast(w);step(w,.05);
  const first=w.damage.ghost;assert.ok(first>0);e.x=30;step(w,1);
  assert.equal(w.damage.ghost,first);
});

test("bone selects a populated line, waits for its windup and penetrates all targets once",()=>{
  const w=world("bone"),near=enemy(w,0,1),line=[3,5,7].map(x=>enemy(w,x));cast(w);
  const a=w.armory.extra.attacks[0];assert.ok(Math.abs(a.angle)<1e-6);
  step(w,.19);assert.equal(w.damage.bone||0,0);step(w,.8);
  assert.equal(near.hp,near.maxHp);assert.ok(line.every(e=>e.hp<e.maxHp));
  assert.ok(Math.abs(w.damage.bone-weaponStats(w,"bone").damage*3)<1e-6);
});

import { stageRecoveryFactor } from "./StagePressure";
import type { SurvivalWorld } from "./SurvivalWorld";
import { ENEMIES, Kind, isElite } from "./SurvivalConfig";
import { Enemy, Hazard, Point, distance } from "./SurvivalTypes";
import { loomMap } from "./LoomMap";
import {
  loomEnvelope,loomSolid,loomMove,loomImpacts,loomCross,loomState,loomEscape,
} from "./LoomGeometry";
export const LIBRARY_KINDS: readonly Kind[] = [
  "ragbound",
  "weftbinder",
  "hemcocoon",
  "shuttlecrawler",
  "twinweftwarden",
  "shuttlejailer",
];
export const loomEnemy = (kind: Kind) => LIBRARY_KINDS.includes(kind);
export interface LoomState {
  action:
    "fixed" | "repeat" | "shuttle" | "pair" | "mixed" | "A" | "B" | "C" | "transition";
  step: number;
  next: number;
  recover: number;
  vulnerable: boolean;
  relocate?: Point;
  waiting?: number;
}
export class LoomSystem {
  private wave = 0;
  private special = 0;
  private rounds = [false, false, false, false];
  private firstReturn = 0;
  private boss = false;
  private horde = 0;
  private rest = 0;
  private lastStart = -Infinity;
  private lastElite = 0;
  readonly stats = {
    fixed: 0,
    repeat: 0,
    shuttle: 0,
    crossings: 0,
    cancelled: 0,
    rejected: 0,

    eliteCasts: { twinweftwarden: 0, shuttlejailer: 0 },
    patterns: { A: 0, B: 0, C: 0 },
    phases: [0, 0, 0],
  };
  constructor(private w: SurvivalWorld) {}
  state(e: Enemy): LoomState {
    return (
      e.loom ??
      (e.loom = {
        action: "fixed",
        step: 0,
        next: 0,
        recover: 2.8,
        vulnerable: false,
      })
    );
  }
  get slots() {
    return this.w.hazards.filter(
      (h) => h.until > this.w.time && !h.loom?.cancelled,
    ).length;
  }
  position(angle: number, r = 9): Point | undefined {
    for (let i = 0; i < 24; i++) {
      const a = angle + (i * Math.PI) / 12,
        p = {
          x: Math.max(-21, Math.min(21, this.w.player.x + Math.cos(a) * r)),
          y: Math.max(-25, Math.min(25, this.w.player.y + Math.sin(a) * r)),
        };
      if (distance(p, this.w.player) > 3 && !loomMap.blocked(p, 0.8))
        return p;
    }
  }
  private spawn(kind: Kind, angle: number, reinforcement = false) {
    const w = this.w,
      c = ENEMIES[kind];
    if (
      w.enemies.filter((e) => e.hp > 0 && e.kind === kind).length >= c.cap ||
      w.enemies.reduce(
        (n, e) => n + (e.hp > 0 ? ENEMIES[e.kind].threat : 0),
        0,
      ) +
        c.threat >
        6
    )
      return;
    const p = this.position(angle);
    if (!p) return;
    const e = w.addEnemy(kind, p.x, p.y, reinforcement);
    if (e) {
      e.state = "arriving";
      e.timer = kind === "boss" ? 2 : 1;
      e.bossReinforcement = reinforcement;
    }
    return e;
  }
  director(dt: number) {
    const w = this.w,
      t = w.time;
    this.wave -= dt;
    this.special -= dt;
    const elites = w.enemies.filter((e) => e.hp > 0 && isElite(e.kind));
    if (t >= 360 && !this.boss) {
      const e = this.spawn("boss", Math.atan2(-w.player.y, -w.player.x));
      if (e) {
        this.boss = true;
        this.horde = t + 3;
        w.effects.push({ type: "boss", ...e });
      }
    }
    if (this.boss) {
      const boss = w.enemies.find((e) => e.hp > 0 && e.kind === "boss");
      if (
        boss &&
        !elites.length &&
        t >= this.rest &&
        t >= this.horde &&
        boss.state !== "recover" &&
        boss.loom?.action !== "transition" &&
        (t - 360) % 14 < 9
      ) {
        const n = w.enemies.filter(
          (e) => e.hp > 0 && e.kind === "ragbound",
        ).length;
        for (let i = 0; i < Math.min(6, 28 - n); i++)
          this.spawn(
            "ragbound",
            (i * Math.PI) / 4 + w.random() * 0.3,
            true,
          );
        this.horde = t + 3;
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      const at = [135, 225, 305, 311][i],
        deadline = i === 2 ? 328 : i === 3 ? 334 : 340;
      if (this.rounds[i] || t < at) continue;
      if (t > deadline) {
        this.rounds[i] = true;
        continue;
      }
      if (i < 3 && (elites.length || t < this.rest)) continue;
      if (i === 3 && (!this.firstReturn || t < this.firstReturn + 6)) continue;
      const e = this.spawn(
        i === 0 || i === 2 ? "twinweftwarden" : "shuttlejailer",
        w.random() * Math.PI * 2,
      );
      if (e) {
        this.rounds[i] = true;
        if (i === 2) this.firstReturn = t;
        this.special = 6;
        w.effects.push({ type: "elite", ...e });
      }
      break;
    }
    const quiet =
      t >= 350 ||
      (t >= 125 && t < 135) ||
      (t >= 215 && t < 225) ||
      (t >= 295 && t < 305);
    if (this.wave <= 0) {
      const n = quiet
        ? 3
        : Math.floor(
            Math.min(16, 6 + Math.floor(t / 40)) *
              (elites.length >= 2 ? 0.7 : 1),
          );
      for (let i = 0; i < n; i++)
        this.spawn(
          "ragbound",
          (i >= n / 2 ? Math.PI : 0) + i * 0.15 + w.random() * 0.3,
        );
      this.wave = quiet ? 4 : 2.7;
    }
    if (
      quiet ||
      elites.length ||
      t < this.rest ||
      this.special > 0 ||
      t < 30 ||
      (t >= 295 && t < 340)
    )
      return;
    const kinds: Kind[] =
      t < 65
        ? ["weftbinder"]
        : t < 95
          ? ["hemcocoon"]
          : t < 125
            ? ["shuttlecrawler"]
            : Math.floor(t / 20) % 2
              ? ["weftbinder", "hemcocoon"]
              : ["hemcocoon", "shuttlecrawler"];
    if (
      w.enemies.some(
        (e) =>
          e.hp > 0 &&
          loomEnemy(e.kind) &&
          e.kind !== "ragbound" &&
          !isElite(e.kind) &&
          !kinds.includes(e.kind),
      )
    )
      return;
    this.spawn(
      kinds[Math.floor(t / 5) % kinds.length],
      w.random() * Math.PI * 2,
    );
    this.special = 9;
  }
  private recover(e: Enemy, seconds = this.state(e).recover) {
    const s = this.state(e);
    e.state = "recover";
    e.timer = seconds * stageRecoveryFactor(this.w.stageId);
    e.immovable = false;
    s.step = 0;
    s.vulnerable = true;
    s.waiting = undefined;
  }
  private move(e: Enemy, dt: number, target = this.w.player) {
    const d = distance(e, target),
      a = loomMap.heading(e, target),
      speed =
        d > 0.3
          ? (e.kind === "boss" ? (d>6.5?5:1.25) : ENEMIES[e.kind].speed) *
            (e.slowUntil > this.w.time ? 1 - e.slow : 1)
          : 0;
    e.facing = a;
    loomMove(
      e,
      { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      dt,
      e.kind === "boss" ? 0.7 : 0.35,
      this.w.time,
    );
  }
  movePlayer(dt: number) {
    const w = this.w;
    this.clean();
    loomMove(
      w.player,
      { x: w.move.x * w.speed, y: w.move.y * w.speed },
      dt,
      0.3,
      w.time,
      (a, z, from, to) => this.sample(a, z, from, to),
    );
  }
  /** All movement segments use the same pulse-split geometry as the renderer. */
  sample(a:Point,z:Point,from:number,to:number){
    const w=this.w;
    for(const h of w.hazards)if(h.loom&&!h.loom.cancelled){
      const b=h.loom;
      for(const pulse of loomImpacts(h,z,to,from,a))if(!b.hits.has(pulse)){
        b.hits.add(pulse);w.hurt(h.damage,h.damageLabel!,false,h.source);
      }
      if(loomCross(h,a,z,from,to)){
        this.stats.crossings++;
        const key=`${b.phase}:${b.group}`,ids=w.challenge.loomGroups.get(key)??new Set<number>();
        ids.add(h.id);w.challenge.loomGroups.set(key,ids);
        if(ids.size===2)w.challenge.loomPhases.add(b.phase);
      }
      if(to>=h.due)h.fired=true;b.last=to;b.player={...z};
    }
  }
  thread(e:Enemy,shape:'fixed'|'repeat'|'shuttle',center:Point=this.w.player,angle=0,delay=0,order=1,reverse=false):Hazard{
    const w=this.w,boss=e.kind==='boss',elite=isElite(e.kind),large=boss||elite;
    const warning=shape==='shuttle'?(large?2.2:2):(large?2.1:shape==='repeat'?2:1.9);
    const d=shape==='shuttle'?2/1.4:shape==='repeat'?3.6:1;
    const velocity=shape==='shuttle'?{x:-Math.sin(angle)*1.4*(reverse?-1:1),y:Math.cos(angle)*1.4*(reverse?-1:1)}:{x:0,y:0};
    const at=w.time+delay,due=at+warning;
    return {id:w.id(),source:e.id,kind:'circle',x:center.x,y:center.y,angle,radius:large?2.7:2.5,width:0,damage:boss?26:elite?24:shape==='shuttle'?22:20,fixedDamage:true,damageLabel:shape==='fixed'?'定纬紧线':shape==='repeat'?'回扣复拍':'移梭裁线',created:at,due,until:due+d,fired:false,next:0,
      loom:{shape,length:shape==='shuttle'?3.8:large?5.4:5,halfWidth:shape==='fixed'&&!large?.16:.18,velocity,group:0,order,phase:e.bossPhase,bossPair:false,last:w.time,player:{...w.player},hits:new Set<number>()}};
  }
  plan(e:Enemy):Hazard[]{
    const w=this.w,s=this.state(e),p={...w.player},boss=e.kind==='boss',phase=e.bossPhase;
    const angle=[0,Math.PI/4,-Math.PI/4,Math.PI/2][e.pattern%4];
    const line=(shape:'fixed'|'repeat'|'shuttle',center=p,a=angle,delay=0,order=1,reverse=false)=>this.thread(e,shape,center,a,delay,order,reverse);
    const parallel=()=>[-1,1].map((v,i)=>line('repeat',{x:p.x-Math.sin(angle)*v*1.6,y:p.y+Math.cos(angle)*v*1.6},angle,i*.8,i+1));
    let items:Hazard[];
    if(s.action==='fixed')items=[line('fixed')];
    else if(s.action==='repeat'){
      const partner=e.kind==='hemcocoon'&&w.time>=265&&w.time<295?w.enemies.find(o=>o.id!==e.id&&o.kind==='hemcocoon'&&o.hp>0&&o.state==='seek'&&o.attack<=0&&o.freezeUntil<=w.time):undefined;
      items=partner?[line('repeat',p,0),this.thread(partner,'repeat',p,Math.PI/2,0,2)]:[line('repeat')];
    }
    else if(s.action==='shuttle')items=[line('shuttle',{x:p.x+Math.sin(angle),y:p.y-Math.cos(angle)})];
    else if(s.action==='pair')items=parallel();
    else if(!boss)items=[line('fixed',p,angle),line('shuttle',{x:p.x+Math.sin(angle),y:p.y-Math.cos(angle)},angle,.5,2)];
    else if(s.action==='A')items=phase===1?[line('fixed')]:[line('fixed',p,0),line('fixed',{x:p.x+(phase===3?.5:0),y:p.y},e.pattern%2?Math.PI/4:-Math.PI/4,.8,2)];
    else if(s.action==='B')items=phase===1?[line('shuttle',{x:p.x+Math.sin(angle),y:p.y-Math.cos(angle)})]:[line(phase===3?'repeat':'fixed',p,angle),line('shuttle',{x:p.x-Math.sin(angle),y:p.y+Math.cos(angle)},angle,.5,2,phase===3)];
    else {
      items=phase===1?[-1,1].map((v,i)=>line('repeat',{x:p.x-Math.sin(angle)*v*1.6,y:p.y+Math.cos(angle)*v*1.6},angle,0,i+1)):[line('repeat',p,angle),line('repeat',p,angle+Math.PI/2,phase===3?.8:0,2)];
      if(phase>=2)for(const h of items){h.until+=.1;h.due+=.1;}
      if(phase===3)for(const h of items)h.damage=28;
    }
    // Translate the complete authored plan before publication, preserving lengths,
    // orthogonality and timing; a screen/arena corner must not invalidate every cast.
    const envelope=items.flatMap(h=>loomEnvelope(h));
    for(const axis of ['x','y'] as const){
      const low=axis==='x'?Math.max(-22,w.camera.x-w.viewport.x+.5):Math.max(-26,w.camera.y-w.viewport.y+2.8);
      const high=axis==='x'?Math.min(22,w.camera.x+w.viewport.x-.5):Math.min(26,w.camera.y+w.viewport.y-2.7);
      const min=Math.min(...envelope.map(p=>p[axis])),max=Math.max(...envelope.map(p=>p[axis]));
      const shift=min<low?low-min:max>high?high-max:0;
      for(const h of items)h[axis]+=shift;
    }
    const group=w.id();for(const h of items){h.loom!.group=group;h.loom!.bossPair=boss&&s.action==='C';}
    return items;
  }
  legal(h:Hazard){return !loomSolid(h)&&loomEnvelope(h).every(p=>Math.abs(p.x-this.w.camera.x)<this.w.viewport.x-.4&&p.y-this.w.camera.y<this.w.viewport.y-2.6&&p.y-this.w.camera.y>-this.w.viewport.y+2.7);}
  private validPlan(items:Hazard[]){return !!items.length&&items.every(h=>this.legal(h))&&loomEscape(this.w,items);}
  private recovery(e: Enemy) {
    const s = this.state(e);
    return e.kind==='boss'?(e.bossPhase===1?(s.action==='C'?4.2:s.action==='B'?3.8:3.6):e.bossPhase===2?(s.action==='A'?4:s.action==='B'?4.2:4.4):(s.action==='A'?4.2:s.action==='B'?4.6:4.8)):isElite(e.kind)?(e.kind==='twinweftwarden'?3.6:3.8):e.kind==='weftbinder'?2.8:3;
  }
  private reject(e: Enemy) {
    this.stats.rejected++;
    this.recover(e);
    this.state(e).relocate = this.position(
      Math.atan2(e.y - this.w.player.y, e.x - this.w.player.x) + Math.PI / 3,
      3.2,
    );
    if (isElite(e.kind)) this.lastElite = e.id;
  }
  begin(e: Enemy) {
    const s = this.state(e);
    const items = this.plan(e);
    s.recover = this.recovery(e);
    if (this.slots + items.length > 2) {
      e.attack = 0.2;
      return false;
    }
    const valid = this.validPlan(items);
    if (!valid) {
      this.reject(e);
      return true;
    }
    this.w.hazards.push(...items);
    for(const other of this.w.enemies)if(other.id!==e.id&&items.some(h=>h.source===other.id)){
      const state=this.state(other);state.action='repeat';state.step=1;state.next=Math.max(...items.map(h=>h.until));state.recover=this.recovery(other);state.vulnerable=false;other.state='windup';other.immovable=true;other.pattern++;
    }
    s.step = 1;
    s.next = Math.max(...items.map((h) => h.until));
    s.vulnerable = false;
    s.waiting = undefined;
    e.state = "windup";
    e.immovable = true;
    for (const h of items) this.stats[h.loom!.shape]++;
    if (
      e.kind === "boss" &&
      (s.action === "A" || s.action === "B" || s.action === "C")
    ) {
      this.stats.patterns[s.action]++;
      this.stats.phases[e.bossPhase - 1]++;
    }
    if (e.kind === "twinweftwarden" || e.kind === "shuttlejailer") {
      this.stats.eliteCasts[e.kind]++;
      this.lastElite = e.id;
    }
    return true;
  }
  private cancelPending(e:Enemy){
    for(const h of this.w.hazards)if(h.source===e.id&&h.loom&&!h.loom.cancelled){
      const b=h.loom!,state=loomState(h,this.w.time);
      if(state==='tight'){
        if(b.shape==='repeat'&&this.w.time<h.due+.7){b.secondCancelled=true;h.until=h.due+.7;}
      }else if(state!=='ended'){b.cancelled=true;h.until=Math.min(h.until,this.w.time);this.stats.cancelled++;}
    }
  }
  clean() {
    const w = this.w;
    for (const e of w.enemies)
      if (e.loom?.step && (e.hp <= 0 || e.freezeUntil > w.time)) {
        this.cancelPending(e);
        if (e.hp > 0 && !w.hazards.some(h=>h.source===e.id&&h.loom&&!h.loom.cancelled&&h.until>w.time)) this.recover(e);
      }
    for(const h of w.hazards)if(h.loom&&!h.loom.cancelled&&!w.enemies.some(e=>e.id===h.source&&e.hp>0)){
      const state=loomState(h,w.time);if(state==='tight'){if(h.loom.shape==='repeat'&&w.time<h.due+.7){h.loom.secondCancelled=true;h.until=h.due+.7;}}else if(state!=='ended'){h.loom.cancelled=true;h.until=Math.min(h.until,w.time);}
    }
  }
  onDeath(e: Enemy) {
    this.cancelPending(e);
    if (
      isElite(e.kind) &&
      !this.w.enemies.some((o) => o.id !== e.id && o.hp > 0 && isElite(o.kind))
    )
      this.rest = this.w.time + (this.w.time >= 360 ? 3 : 6);
    return false;
  }
  private eliteTurn(e: Enemy) {
    const w = this.w,
      s = this.state(e);
    s.waiting ??= w.time;
    const ready = w.enemies
      .filter(
        (o) =>
          o.hp > 0 &&
          isElite(o.kind) &&
          o.state === "seek" &&
          o.attack <= 0 &&
          o.freezeUntil <= w.time,
      )
      .sort(
        (a, b) =>
          (this.state(a).waiting ?? w.time) -
            (this.state(b).waiting ?? w.time) ||
          Number(a.id === this.lastElite) - Number(b.id === this.lastElite) ||
          a.id - b.id,
      );
    return !ready.length || ready[0].id === e.id;
  }
  stepEnemy(e: Enemy, dt: number) {
    const w = this.w,
      s = this.state(e),
      boss = e.kind === "boss";
    if (boss) {
      const target = e.hp / e.maxHp <= 0.35 ? 3 : e.hp / e.maxHp <= 0.7 ? 2 : 1;
      if (target > e.bossPhase) {
        e.bossPhase = target;
        this.cancelPending(e);
        s.next = Math.max(
          s.action === "transition" ? s.next : w.time + 1.5,
          ...w.hazards
            .filter(
              (h) => h.source === e.id && h.fired && !h.loom?.cancelled && h.until>w.time,
            )
            .map((h) => h.until),
        );
        s.action = "transition";
        s.step = 0;
        s.vulnerable = false;
        e.pattern = 0;
        e.state = "windup";
        e.immovable = true;
        w.effects.push({ type: "bossPhase", ...e, value: e.bossPhase });
        return;
      }
    }
    if (e.freezeUntil > w.time) {
      if (s.step) {
        this.cancelPending(e);
        if(!w.hazards.some(h=>h.source===e.id&&h.loom&&!h.loom.cancelled&&h.until>w.time))this.recover(e);
      }
      return;
    }
    if (s.action === "transition") {
      e.timer = Math.max(0, s.next - w.time);
      if (w.time >= s.next) {
        s.action = "fixed";
        this.recover(e, 1);
      }
      return;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "seek";
        s.vulnerable = false;
        e.attack = e.kind === "boss" || isElite(e.kind) ? 0 : e.kind === "hemcocoon" ? 3.6 : e.kind === "shuttlecrawler" ? 3.4 : 3.2;
      }
      return;
    }
    if (s.step) {
      const live = w.hazards.filter(
        (h) =>
          h.source === e.id &&
          h.loom &&
          !h.loom.cancelled &&
          h.until > w.time,
      );
      e.timer = Math.max(0, ...live.map((h) => h.due - w.time));
      if (!live.length) this.recover(e);
      return;
    }
    if (e.kind === "ragbound") {
      this.move(e, dt);
      if (distance(e, w.player) < 0.65) w.hurt(12, e.kind, false);
      return;
    }
    if (boss && w.enemies.some((o) => o.hp > 0 && isElite(o.kind))) {
      this.rest = w.time + 3;
      return;
    }
    if (boss && w.time < this.rest) return;
    if (
      !boss &&
      !isElite(e.kind) &&
      w.enemies.some((o) => o.hp > 0 && isElite(o.kind))
    )
      return;
    if (s.relocate) {
      if (distance(e, s.relocate) > 0.3) {
        this.move(e, dt, s.relocate);
        return;
      }
      s.relocate = undefined;
    }
    const d = distance(e, w.player);
    if (d > 8.5 || !w.visible(e, 1)) {
      this.move(e, dt);
      return;
    }
    if (d < (boss ? 1 : 0.65))
      w.hurt(boss ? 22 : ENEMIES[e.kind].contact, e.kind, false);
    e.attack -= dt;
    if (e.attack > 0) {
      if (d > (boss ? 0.8 : 3.2)) this.move(e, dt);
      return;
    }
    if (isElite(e.kind) && !this.eliteTurn(e)) return;
    if (!boss && !isElite(e.kind) && w.time - this.lastStart < 3) {
      e.attack = 0.2;
      return;
    }
    s.action = boss
      ? ((e.bossPhase === 1
          ? ["A", "B", "C"]
          : e.bossPhase === 2
            ? ["B", "A", "C"]
            : ["C", "B", "A"])[e.pattern % 3] as "A" | "B" | "C")
      : e.kind === "twinweftwarden"
        ? "pair"
        : e.kind === "shuttlejailer" ? "mixed" : e.kind === "shuttlecrawler"
          ? "shuttle"
          : e.kind === "hemcocoon"
            ? "repeat"
            : "fixed";
    if (this.begin(e)) {
      e.pattern++;
      this.lastStart = w.time;
    }
  }
  stepHazard(h: Hazard) {
    const w = this.w,
      b = h.loom!;
    if (b.cancelled) return;
    // Move-player normally samples all actual segments; this also handles explicit test/debug time advances.
    if (b.last < w.time) this.sample(b.player, w.player, b.last, w.time);
  }
}

import { gameFont } from './runtime';
import { HOLE, clubFor, distanceToCup, type GolfState, type SwingState } from './rules';
import { createTreeSprite, createGroundTexture, createSoftShadow } from './course-art';
import { SwingAnimation, FULL_IMPACT_SECONDS, PUTT_IMPACT_SECONDS } from './swing-animation';
import { GolferRenderer } from './golfer-renderer';

/** The physical ring travels in the quiet center lane, separate from the digital ball. */
export const COURSE_LAYOUT = {
  horizon: 300,
  swingTop: 800,
  guideX: 1600,
  lane: { x: 750, y: 790, width: 420, height: 242 },
} as const;

type Point = { x: number; z: number; y?: number };
type ScreenPoint = { x: number; y: number; scale: number; depth: number };
type Camera = { x: number; z: number; yaw: number; distance: number; height: number };
type TracePoint = Point & { time: number };
const TAU = Math.PI * 2;
const FOCAL = 1120;
const PITCH = 0.21;
const CENTER_Y = COURSE_LAYOUT.horizon + FOCAL * Math.tan(PITCH);
const ADDRESS_CAMERA = { distance: 17.2, height: 6.34 };
const PUTT_CAMERA = { distance: 16, height: 5.9 };
const FLIGHT_CAMERA = { distance: 26, height: 10 };
type Surface = 'fairway' | 'rough' | 'green' | 'sand';
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function polygon(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], color: string) {
  if (pts.length < 3) return;
  ctx.fillStyle = color; ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath(); ctx.fill();
}

function canvasLayer(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d')!);
  return canvas;
}

/** Original painted coastal scenery, baked once; no per-frame shadows, filters or pixel reads. */
function backdrop() {
  return canvasLayer(1920, 1080, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, '#4BABB8'); sky.addColorStop(0.62, '#B5DDD1'); sky.addColorStop(1, '#F2E5BD');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1920, 1080);
    ctx.fillStyle = '#F8EDC4'; ctx.beginPath(); ctx.arc(1510, 155, 61, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E5EBD0';
    for (const [x, y, w, h] of [[180, 111, 180, 18], [326, 102, 106, 25], [1135, 88, 145, 15], [1255, 82, 88, 22]]) {
      ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
    }
    polygon(ctx, [{x:0,y:305},{x:0,y:247},{x:115,y:227},{x:235,y:258},{x:357,y:205},{x:462,y:218},{x:586,y:276},{x:715,y:248},{x:824,y:282},{x:950,y:307}], '#83B7AC');
    polygon(ctx, [{x:0,y:325},{x:0,y:281},{x:122,y:263},{x:203,y:284},{x:305,y:253},{x:393,y:266},{x:462,y:296},{x:585,y:280},{x:685,y:313}], '#5C9790');
    polygon(ctx, [{x:1280,y:310},{x:1400,y:281},{x:1470,y:290},{x:1602,y:251},{x:1690,y:264},{x:1784,y:230},{x:1920,y:270},{x:1920,y:321}], '#75AA9E');
    const sea = ctx.createLinearGradient(0, 300, 0, 820);
    sea.addColorStop(0, '#79B5AD'); sea.addColorStop(0.28, '#4B9D9C'); sea.addColorStop(1, '#236F7B');
    ctx.fillStyle = sea; ctx.fillRect(0, 305, 1920, 775);
    ctx.strokeStyle = '#B5D3BC'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 22; i++) {
      const y = 317 + i * i * 0.67;
      const x = (i * 179) % 1630;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 100 + i * 8, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

const TREES = [
  {x:-43,z:20,h:12}, {x:-38,z:48,h:13}, {x:-44,z:72,h:11},
  {x:-40,z:94,h:14}, {x:-48,z:136,h:11}, {x:-37,z:169,h:12},
  {x:43,z:58,h:10}, {x:46,z:103,h:11}, {x:39,z:178,h:12},
];

export class CourseView {
  private camera: Camera = { x: 0, z: 0, yaw: 0, ...ADDRESS_CAMERA };
  private initialized = false;
  private sky: HTMLCanvasElement | null = null;
  private terrain: HTMLCanvasElement | null = null;
  private trees: HTMLCanvasElement[] = [];
  private terrainKey = '';
  private trace: TracePoint[] = [];
  private priorPhase = '';
  private landing: (Point & { at: number }) | null = null;
  private backswingHeld = false;
  private animation = new SwingAnimation();
  private shotElapsed = Infinity;
  private strokeIsPutt = false;
  private golferAt: Point = { x: 0, z: 0 };
  private golferYaw = 0;
  private textures = new Map<Surface, CanvasPattern>();
  private softShadow: HTMLCanvasElement | null = null;
  private golferRenderer = new GolferRenderer();

  private loadScenery() {
    const photo = new Image();
    photo.onload = () => {
      this.sky = canvasLayer(1920, 1080, ctx => {
        ctx.fillStyle = '#32698A'; ctx.fillRect(0, 0, 1920, 1080);
        const scale = 1.38;
        ctx.drawImage(photo, (1920-photo.naturalWidth*scale)/2, COURSE_LAYOUT.horizon-photo.naturalHeight*0.60*scale, photo.naturalWidth*scale, photo.naturalHeight*scale);
      });
    };
    photo.src = 'art/coastal-sky.png';
    const turf = new Image();
    turf.onload = () => {
      // Reduce once to a small repeating material. The photograph supplies actual blade detail.
      const tile = canvasLayer(256,256,c => {c.drawImage(turf,0,0,256,256);});
      const pattern = this.terrain!.getContext('2d')!.createPattern(tile,'repeat');
      if(pattern) {for(const kind of ['fairway','rough','green'] as const)this.textures.set(kind,pattern);this.terrainKey='';}
    };
    turf.src = 'art/fairway-turf.png';
  }

  /** Only gesture intent is passed in; the golfer is anchored to the digital ball's lie. */
  setSwing(stage: SwingState['stage'], backwardTravel = 0): void {
    // Anticipate the takeaway before the physical gesture reaches its arming threshold.
    this.backswingHeld = stage === 'backswing' || (stage === 'ready' && backwardTravel > 12);
  }

  startStroke(game: GolfState, putting: boolean): void {
    this.strokeIsPutt=putting;this.shotElapsed=0;
    this.golferAt={...game.lastSafe};this.animation.strike(putting);
  }

  advanceSwing(dt: number, putting = false): {impact:boolean;putting:boolean;ballDt:number} {
    const delta=Number.isFinite(dt)?clamp(dt,0,1):0;
    const before=this.shotElapsed;
    if(Number.isFinite(before))this.shotElapsed+=delta;
    const pose=this.animation.update(delta,this.backswingHeld,putting);
    const contact=this.strokeIsPutt?PUTT_IMPACT_SECONDS:FULL_IMPACT_SECONDS;
    const ballDt=Number.isFinite(before)?Math.max(0,this.shotElapsed-contact)-Math.max(0,before-contact):delta;
    return {impact:pose.impact,putting:this.strokeIsPutt,ballDt};
  }

  reset(game: GolfState) {
    const close = clubFor(game) === 'PUTTER';
    this.camera = {
      x: game.ball.x, z: game.ball.z,
      yaw: Math.atan2(HOLE.flag.x - game.ball.x, HOLE.flag.z - game.ball.z),
      ...(close ? PUTT_CAMERA : ADDRESS_CAMERA),
    };
    this.initialized = true; this.trace = []; this.terrainKey = ''; this.landing = null;
    this.priorPhase = game.phase;
    this.golferAt = { x: game.ball.x, z: game.ball.z };
    this.golferYaw = this.camera.yaw;
    this.shotElapsed=Infinity;this.animation.reset();this.backswingHeld=false;
  }

  private forward(p: Point) {
    return (p.x - this.camera.x) * Math.sin(this.camera.yaw) + (p.z - this.camera.z) * Math.cos(this.camera.yaw) + this.camera.distance;
  }

  private project(p: Point): ScreenPoint {
    const c = this.camera, sin = Math.sin(c.yaw), cos = Math.cos(c.yaw);
    const dx = p.x - c.x, dz = p.z - c.z;
    const side = dx * cos - dz * sin;
    const forward = dx * sin + dz * cos + c.distance;
    const down = c.height - (p.y ?? 0);
    const depth = forward * Math.cos(PITCH) + down * Math.sin(PITCH);
    const scale = FOCAL / Math.max(0.5, depth);
    return { x: 960 + side * scale, y: CENTER_Y + (down * Math.cos(PITCH) - forward * Math.sin(PITCH)) * scale, scale, depth };
  }

  /** Clip ground polygons before projection; the near plane cannot fold across the screen. */
  private ground(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, surface?: Surface) {
    const clipped: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const da = this.forward(a), db = this.forward(b);
      if (da >= 1) clipped.push(a);
      if ((da >= 1) !== (db >= 1)) {
        const t = (1 - da) / (db - da);
        clipped.push({x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),y:mix(a.y??0,b.y??0,t)});
      }
    }
    const screen = clipped.map(p => this.project(p));
    polygon(ctx, screen, color);
    const texture = surface && this.textures.get(surface);
    if (!texture || clipped.length < 3) return;
    // A world-anchored texture follows each small mown strip and is cached with the terrain.
    const center = clipped.reduce((p,q) => ({x:p.x+q.x/clipped.length,z:p.z+q.z/clipped.length}),{x:0,z:0});
    const origin = this.project(center), across = this.project({x:center.x+1,z:center.z}), along = this.project({x:center.x,z:center.z+1});
    const density = surface === 'sand' ? 80 : surface === 'rough' ? 36 : surface === 'green' ? 84 : 58;
    ctx.save();ctx.beginPath();screen.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
    ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=surface==='rough'?0.78:surface==='fairway'?0.72:0.48;
    ctx.transform((across.x-origin.x)/density,(across.y-origin.y)/density,(along.x-origin.x)/density,(along.y-origin.y)/density,origin.x,origin.y);
    ctx.translate(-center.x*density,-center.z*density);ctx.fillStyle=texture;
    ctx.fillRect(-120*density,-80*density,240*density,360*density);ctx.restore();
  }

  private ovalPoints(x: number, z: number, rx: number, rz: number, y = 0) {
    return Array.from({length:65}, (_,i) => ({x:x+Math.cos(i/64*TAU)*rx,z:z+Math.sin(i/64*TAU)*rz,y}));
  }

  private paintTerrain(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 1920, 1080);
    const b = HOLE.bounds;
    // The island's grass edge is the actual playable boundary; sand and cliff lie outside it.
    const rim = [{x:b.left-3,z:b.near-3,y:-2},{x:b.right+3,z:b.near-3,y:-2},{x:b.right+3,z:b.far+3,y:-2},{x:b.left-3,z:b.far+3,y:-2}];
    this.ground(ctx,rim,'#D3BC84');
    this.ground(ctx,[{x:b.left,z:b.near},{x:b.right,z:b.near},{x:b.right,z:b.far},{x:b.left,z:b.far}],'#426538','rough');
    const center = (z:number) => Math.sin(z/45)*5;
    const width = (z:number) => 19 + Math.sin(clamp(z/150,0,1)*Math.PI)*5;
    const ribbon: Point[] = [];
    for (let z=b.near;z<=b.far;z+=2) ribbon.push({x:center(z)-width(z)-1.6,z});
    ribbon.push({x:center(b.far)-width(b.far)-1.6,z:b.far});
    for (let z=b.far;z>=b.near;z-=2) ribbon.push({x:center(z)+width(z)+1.6,z});
    this.ground(ctx,ribbon,'#7B9251','fairway');
    for (let z=b.far;z>b.near;z-=7) {
      const low=Math.max(b.near,z-7), mid=(z+low)/2;
      const pts=[{x:center(low)-width(low),z:low},{x:center(mid)-width(mid),z:mid},{x:center(z)-width(z),z},
        {x:center(z)+width(z),z},{x:center(mid)+width(mid),z:mid},{x:center(low)+width(low),z:low}];
      this.ground(ctx,pts,Math.floor(z/7)%2 ? '#698449' : '#758E50','fairway');
    }
    const green=HOLE.green;
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx+1.8,green.rz+1.8),'#537F42');
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx+0.8,green.rz+0.8),'#BDD17C');
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx,green.rz),'#96AE63','green');
    // Mowed green bands use the exact ellipse used by the rules.
    for(let z=green.z-green.rz;z<green.z+green.rz;z+=3.4) {
      if(Math.floor((z-green.z+green.rz)/3.4)%2) continue;
      const top=Math.min(green.z+green.rz,z+3.4), pts:Point[]=[];
      for(let i=0;i<=8;i++) {const zz=mix(z,top,i/8),w=green.rx*Math.sqrt(Math.max(0,1-((zz-green.z)/green.rz)**2));pts.push({x:green.x-w,z:zz});}
      for(let i=8;i>=0;i--) {const zz=mix(z,top,i/8),w=green.rx*Math.sqrt(Math.max(0,1-((zz-green.z)/green.rz)**2));pts.push({x:green.x+w,z:zz});}
      this.ground(ctx,pts,'#A0B66C','green');
    }
    const sand=HOLE.bunker;
    this.ground(ctx,this.ovalPoints(sand.x,sand.z,sand.rx+0.65,sand.rz+0.65),'#355E39');
    this.ground(ctx,this.ovalPoints(sand.x,sand.z,sand.rx,sand.rz),'#C7B78C','sand');
    this.ground(ctx,this.ovalPoints(sand.x+0.4,sand.z+0.6,sand.rx-1.5,sand.rz-1.8),'#DED0A8','sand');
    // Small raked strokes are baked with the course, never recalculated under a resting camera.
    for(let i=0;i<6;i++) {
      const z=sand.z-6+i*2;
      this.ground(ctx,[{x:sand.x-4,z},{x:sand.x+4,z:z+0.5},{x:sand.x+4,z:z+0.65},{x:sand.x-4,z:z+0.15}],'#D7BC83');
    }
    this.ground(ctx,[{x:-3.5,z:-2},{x:3.5,z:-2},{x:3.5,z:1},{x:-3.5,z:1}],'#607D43','green');
    for(const x of [-3.4,3.4]) this.ground(ctx,[{x:x-0.3,z:-1},{x:x+0.3,z:-1},{x:x+0.3,z:-0.4},{x:x-0.3,z:-0.4}],'#F8EBC4');
    const visible=TREES.map((t,i)=>({...t,index:i,p:this.project(t)})).filter(t=>t.p.depth>4).sort((a,b)=>b.p.depth-a.p.depth);
    for(const tree of visible) {
      const h=tree.h*tree.p.scale,w=h*(320/440);
      if(tree.p.x+w<0||tree.p.x-w>1920)continue;
      if(this.softShadow) {ctx.globalAlpha=0.48;ctx.drawImage(this.softShadow,tree.p.x-w*0.8,tree.p.y-h*0.04,w*1.6,h*0.13);ctx.globalAlpha=1;}
      ctx.drawImage(this.trees[tree.index%2],tree.p.x-w/2,tree.p.y-h,w,h);
    }
    // Subtle stakes communicate the out-of-bounds coastline without introducing a UI wall.
    for(const z of [18,55,95,133,176]) for(const x of [-57.6,57.6]) {
      const foot=this.project({x,z}),tip=this.project({x,z,y:1.1});
      if(foot.depth<4)continue;
      ctx.strokeStyle='#E8DFB7';ctx.lineWidth=clamp(foot.scale*0.10,1.5,4);
      ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
    }
  }

  draw(ctx: CanvasRenderingContext2D, game: GolfState, now: number, dt: number, preview = false) {
    if(!this.initialized)this.reset(game);
    if(!this.sky) {
      this.sky=backdrop();this.trees=[createTreeSprite(0),createTreeSprite(1)];this.softShadow=createSoftShadow();
      for(const kind of ['fairway','rough','green','sand'] as const) {const pattern=ctx.createPattern(createGroundTexture(kind),'repeat');if(pattern)this.textures.set(kind,pattern);}
      this.terrain=canvasLayer(1920,1080,()=>{});this.loadScenery();
    }
    const moving=game.phase==='flight'||game.phase==='rolling';
    const close=clubFor(game)==='PUTTER';
    const framing=game.phase==='flight'?FLIGHT_CAMERA:close?PUTT_CAMERA:ADDRESS_CAMERA;
    const targetYaw=distanceToCup(game)>1.5 ? Math.atan2(HOLE.flag.x-game.ball.x,HOLE.flag.z-game.ball.z) : this.camera.yaw;
    if(game.phase==='ready'){
      this.golferAt={x:game.ball.x,z:game.ball.z};this.golferYaw=targetYaw;
      if(this.priorPhase==='flight'||this.priorPhase==='rolling'){this.shotElapsed=Infinity;this.animation.reset();}
    }
    // Ease the camera out only after contact; pause never consumes animation time.
    const impactAt=this.strokeIsPutt?PUTT_IMPACT_SECONDS:FULL_IMPACT_SECONDS;
    const departure=clamp((this.shotElapsed-impactAt-0.18)/0.2,0,1);
    const chase=moving?departure*departure*(3-2*departure):1;
    const blend=(1-Math.exp(-Math.max(0,dt)*(moving?2.5:4)))*chase;
    const c=this.camera;
    c.x=mix(c.x,game.ball.x,blend);c.z=mix(c.z,game.ball.z,blend);
    if(!moving)c.yaw+=angleDelta(c.yaw,targetYaw)*blend;
    c.distance=mix(c.distance,framing.distance,blend);
    c.height=mix(c.height,framing.height+game.ball.y*0.65,blend);
    if(!moving) {
      if(Math.abs(c.x-game.ball.x)<0.002)c.x=game.ball.x;
      if(Math.abs(c.z-game.ball.z)<0.002)c.z=game.ball.z;
      if(Math.abs(angleDelta(c.yaw,targetYaw))<0.0001)c.yaw=targetYaw;
      if(Math.abs(c.height-framing.height)<0.002)c.height=framing.height;
      if(Math.abs(c.distance-framing.distance)<0.002)c.distance=framing.distance;
    }
    const key=[c.x,c.z,c.yaw,c.distance,c.height].map(v=>v.toFixed(3)).join('|');
    if(key!==this.terrainKey){this.paintTerrain(this.terrain!.getContext('2d')!);this.terrainKey=key;}
    ctx.drawImage(this.sky,0,0);ctx.drawImage(this.terrain!,0,0);
    ctx.save();ctx.beginPath();ctx.rect(0,0,1920,COURSE_LAYOUT.swingTop);ctx.clip();
    if(!preview&&game.phase==='ready')this.drawAim(ctx,game,now);
    this.drawFlag(ctx,now);
    if(this.priorPhase==='flight'&&game.phase==='rolling')this.landing={x:game.ball.x,z:game.ball.z,at:now};
    this.priorPhase=game.phase;
    if(moving) {
      const previous=this.trace[this.trace.length-1];
      if(!previous||Math.hypot(game.ball.x-previous.x,game.ball.z-previous.z,(game.ball.y??0)-(previous.y??0))>0.4)
        this.trace.push({x:game.ball.x,z:game.ball.z,y:game.ball.y,time:now});
    }
    this.trace=this.trace.filter(p=>now-p.time<650).slice(-35);
    for(let i=1;i<this.trace.length;i++) {
      const a=this.project(this.trace[i-1]),b=this.project(this.trace[i]);
      if(a.depth<1||b.depth<1)continue;
      ctx.globalAlpha=(1-(now-this.trace[i].time)/650)*0.5;ctx.strokeStyle='#FFF4CF';ctx.lineWidth=2+i/this.trace.length*3;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.globalAlpha=1;
    if(this.landing&&now-this.landing.at<520) {
      const t=(now-this.landing.at)/520,p=this.project(this.landing);
      ctx.globalAlpha=(1-t)*0.45;ctx.strokeStyle='#F5E4B4';ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(p.x,p.y,8+t*45,3+t*12,0,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    }
    this.drawGolfer(ctx,game);
    if(game.phase!=='holed')this.drawBall(ctx,game,now);
    ctx.restore();
    // A quiet fixed surface for the hand and ring; no marker follows physical motion.
    const footer=ctx.createLinearGradient(0,780,0,865);
    footer.addColorStop(0,'rgba(18,57,44,0)');footer.addColorStop(1,'#12392C');
    ctx.fillStyle=footer;ctx.fillRect(0,780,1920,100);
    ctx.fillStyle='#12392C';ctx.fillRect(0,880,1920,200);
    ctx.fillStyle='#9BB78B';ctx.globalAlpha=0.25;ctx.fillRect(48,819,1824,2);ctx.globalAlpha=1;
  }

  /** Original three-quarter character. All pose coordinates belong to this digital golfer. */
  private drawGolfer(ctx:CanvasRenderingContext2D,game:GolfState) {
    const moving=game.phase==='flight'||game.phase==='rolling';
    const age=this.shotElapsed*1000;
    const shot=moving&&Number.isFinite(age);
    const alpha=shot?clamp(1-(age-600)/650,0,1):1;
    if(alpha<=0||game.phase==='holed'||game.phase==='limit')return;
    const right={x:Math.cos(this.golferYaw),z:-Math.sin(this.golferYaw)};
    const forward={x:Math.sin(this.golferYaw),z:Math.cos(this.golferYaw)};
    const standing={x:this.golferAt.x-right.x*2.8-forward.x*0.45,z:this.golferAt.z-right.z*2.8-forward.z*0.45};
    const foot=this.project(standing),ball=this.project(this.golferAt);
    if(foot.depth<3||foot.y>1000||foot.y<250)return;
    const scale=clamp(foot.scale*5.5/240,0.3,1.6);
    const putting=clubFor({...game,ball:{...game.ball,x:this.golferAt.x,z:this.golferAt.z}})==='PUTTER';
    const through=this.animation.pose.followThrough;
    const wind=this.animation.pose.windup;
    const turn=through*12-wind*5;
    const lift=through*6;
    ctx.save();ctx.globalAlpha=alpha;
    if(this.softShadow)ctx.drawImage(this.softShadow,foot.x-70*scale,foot.y-12*scale,150*scale,28*scale);
    ctx.restore();
    if(this.golferRenderer.draw(ctx,{footX:foot.x,footY:foot.y,ballX:ball.x,ballY:ball.y-2,
      scale,windup:wind,followThrough:through,putting,alpha}))return;
    const ballLocal={x:(ball.x-foot.x)/scale,y:(ball.y-foot.y)/scale};
    const grip={x:mix(47,-25,wind)+through*8,y:mix(-119,-202,wind)-through*84};
    const clubEnd={
      x:mix(ballLocal.x,-63,wind)+(putting?0:through*(-98-ballLocal.x)),
      y:mix(ballLocal.y-2,-264,wind)+(putting?through*-20:through*(-244-ballLocal.y)),
    };
    // A putt keeps the arms low: the same person makes a compact pendulum motion.
    if(putting){grip.x=47-wind*15+through*13;grip.y=-119-wind*4-through*5;clubEnd.x=ballLocal.x-wind*50+through*43;clubEnd.y=ballLocal.y-2-wind*10-through*12;}
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(foot.x,foot.y);ctx.scale(scale,scale);
    const shape=(points:number[][],color:string)=>polygon(ctx,points.map(([x,y])=>({x,y})),color);
    const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();};
    const limb=(points:number[][],width:number,color:string)=>{
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    };
    // Grounded shadow, two separate trouser legs and shoes establish a full-body stance.
    oval(0,-1,64,10,'rgba(22,49,34,0.28)');
    shape([[-20,-108],[6,-104],[2,-63],[-16,-13],[-34,-14],[-24,-64]],'#293F47');
    shape([[3,-106],[28,-103],[32,-61],[24,-13-lift],[7,-13-lift],[10,-62]],'#354F54');
    shape([[5,-100],[15,-101],[19,-59],[13,-25-lift],[8,-25-lift],[10,-62]],'#4C6262');
    shape([[-35,-17],[-15,-17],[-11,-8],[-16,0],[-45,0],[-49,-5],[-42,-11]],'#ECE7CD');
    shape([[-49,-5],[-16,-5],[-16,1],[-45,1],[-50,-2]],'#213B36');
    shape([[8,-16-lift],[27,-15-lift],[37,-6-lift],[33,0-lift],[8,0-lift],[4,-6-lift]],'#F6EFD7');
    shape([[5,-5-lift],[37,-5-lift],[33,1-lift],[8,1-lift]],'#243D37');
    limb([[-38,-9],[-27,-9]],2,'#B9BDA8');limb([[13,-9-lift],[25,-9-lift]],2,'#B9BDA8');
    // Warm polo: a broad back, separate side plane, sleeve hems, collar and waist band.
    shape([[-25+turn,-187],[-2+turn,-197],[25+turn,-184],[35+turn,-155],[24,-105],[-24,-105],[-31+turn,-149]],'#CB7753');
    shape([[-25+turn,-187],[-11+turn,-192],[-10,-154],[-18,-107],[-25,-107],[-31+turn,-149]],'#A65743');
    shape([[10+turn,-190],[26+turn,-183],[35+turn,-154],[28,-123],[22,-107],[14,-107],[20,-147]],'#DE9164');
    shape([[-24,-110],[24,-110],[25,-102],[-23,-102]],'#213E40');
    shape([[2,-109],[11,-109],[11,-102],[2,-102]],'#C6B584');
    // Rear arm first, front arm second; thick sleeves and forearms remain recognizably human.
    const backShoulder=[-22+turn,-177];
    const backElbow=[mix(-18,-40,wind)+through*15,mix(-144,-177,wind)-through*27];
    const frontShoulder=[28+turn,-175];
    const frontElbow=[mix(35,3,wind)+through*12,mix(-141,-173,wind)-through*36];
    limb([backShoulder,backElbow],22,'#B7654B');
    limb([backElbow,[grip.x-3,grip.y+5]],14,'#C58E65');
    limb([frontShoulder,[mix(frontShoulder[0],frontElbow[0],0.6),mix(frontShoulder[1],frontElbow[1],0.6)]],24,'#E29466');
    limb([[mix(frontShoulder[0],frontElbow[0],0.55),mix(frontShoulder[1],frontElbow[1],0.55)],frontElbow,[grip.x+3,grip.y]],15,'#E2AF80');
    // Neck, ear and a turned profile under the cream cap show the facing direction.
    shape([[3+turn,-201],[21+turn,-200],[22+turn,-185],[8+turn,-184]],'#D4A074');
    shape([[-2+turn,-193],[9+turn,-190],[16+turn,-184],[7+turn,-179],[-7+turn,-187]],'#EEE3C1');
    shape([[18+turn,-191],[27+turn,-184],[23+turn,-175],[15+turn,-185]],'#9D4F3F');
    oval(10+turn,-213,20,25,'#C99168');
    shape([[18+turn,-233],[30+turn,-223],[31+turn,-213],[38+turn,-208],[32+turn,-202],[30+turn,-193],[18+turn,-191],[11+turn,-205]],'#E3B285');
    shape([[-7+turn,-224],[1+turn,-234],[20+turn,-232],[13+turn,-222],[10+turn,-208],[-2+turn,-201],[-9+turn,-210]],'#5C4C3C');
    oval(11+turn,-210,4,6,'#D49B70');
    // Cap crown and visor are solid shapes, with a darker back panel and stitched center seam.
    ctx.fillStyle='#F7EAC7';ctx.beginPath();ctx.moveTo(-11+turn,-220);ctx.bezierCurveTo(-13+turn,-244,14+turn,-249,30+turn,-232);ctx.lineTo(34+turn,-219);ctx.closePath();ctx.fill();
    shape([[-11+turn,-221],[-9+turn,-232],[2+turn,-242],[5+turn,-224],[1+turn,-218]],'#D7D6B9');
    shape([[11+turn,-224],[35+turn,-224],[49+turn,-218],[46+turn,-213],[25+turn,-216],[10+turn,-216]],'#E8D9AF');
    limb([[10+turn,-243],[14+turn,-226]],1.5,'#C8C5A7');
    // Metallic shaft reaches the actual digital ball at address, with a dark grip and iron head.
    limb([[grip.x,grip.y],[clubEnd.x,clubEnd.y]],4,'#BBC9BD');
    limb([[grip.x-1,grip.y],[mix(grip.x,clubEnd.x,0.18),mix(grip.y,clubEnd.y,0.18)]],6,'#254A40');
    oval(grip.x-3,grip.y+3,7,9,'#F4EAD2');
    oval(grip.x+4,grip.y-1,6,8,'#E2AF80');
    ctx.save();ctx.translate(clubEnd.x,clubEnd.y);ctx.rotate(putting?-0.08:Math.atan2(clubEnd.y-grip.y,clubEnd.x-grip.x)-Math.PI/2);
    shape([[-10,-3],[8,-5],[12,0],[9,8],[-7,8],[-11,3]],'#536A64');
    shape([[-9,-3],[8,-5],[10,-1],[-7,3]],'#D7E0CB');ctx.restore();
    ctx.restore();
  }

  private drawAim(ctx:CanvasRenderingContext2D,game:GolfState,now:number) {
    const length=Math.min(distanceToCup(game)-1,clubFor(game)==='PUTTER'?14:24);
    if(length<=0)return;
    const yaw=Math.atan2(HOLE.flag.x-game.ball.x,HOLE.flag.z-game.ball.z);
    ctx.strokeStyle='#F8E8B6';ctx.lineCap='round';ctx.globalAlpha=0.48+Math.sin(now/800)*0.08;
    const step=length/8;
    for(let i=1;i<8;i++) {
      const a=this.project({x:game.ball.x+Math.sin(yaw)*step*i,z:game.ball.z+Math.cos(yaw)*step*i,y:0.03});
      const b=this.project({x:game.ball.x+Math.sin(yaw)*step*(i+0.35),z:game.ball.z+Math.cos(yaw)*step*(i+0.35),y:0.03});
      ctx.lineWidth=clamp(a.scale*0.09,2,4);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  private drawFlag(ctx:CanvasRenderingContext2D,now:number) {
    const base=this.project(HOLE.flag);
    if(base.depth<2)return;
    const tip=this.project({...HOLE.flag,y:5.4});
    this.ground(ctx,this.ovalPoints(HOLE.flag.x,HOLE.flag.z,HOLE.cupRadius+0.08,HOLE.cupRadius+0.08),'#2A4C35');
    this.ground(ctx,this.ovalPoints(HOLE.flag.x,HOLE.flag.z,HOLE.cupRadius,HOLE.cupRadius),'#162F27');
    ctx.strokeStyle='#F7EFD7';ctx.lineWidth=clamp(base.scale*0.12,3,7);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
    const size=clamp(base.scale*2.8,31,90),wave=Math.sin(now/260)*size*0.06;
    polygon(ctx,[{x:tip.x,y:tip.y},{x:tip.x+size*0.55,y:tip.y+size*0.05+wave},{x:tip.x+size,y:tip.y+size*0.22},{x:tip.x+size*0.60,y:tip.y+size*0.40+wave},{x:tip.x,y:tip.y+size*0.36}],'#F0B75C');
    polygon(ctx,[{x:tip.x,y:tip.y+size*0.36},{x:tip.x+size*0.60,y:tip.y+size*0.40+wave},{x:tip.x+size,y:tip.y+size*0.22},{x:tip.x+size*0.60,y:tip.y+size*0.49+wave},{x:tip.x,y:tip.y+size*0.44}],'#D88A45');
  }

  private drawBall(ctx:CanvasRenderingContext2D,game:GolfState,now:number) {
    const p=this.project({x:game.ball.x,z:game.ball.z,y:game.ball.y+0.2});
    const ground=this.project(game.ball);
    if(p.depth<1)return;
    const radius=clamp(p.scale*0.27,7,14);
    const shadow=this.project({x:game.ball.x,z:game.ball.z});
    ctx.fillStyle='#24482D';ctx.globalAlpha=clamp(0.48-game.ball.y/80,0.12,0.48);
    ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,clamp(shadow.scale*0.3,6,18)+game.ball.y*0.2,clamp(shadow.scale*0.08,2,5),0,0,TAU);ctx.fill();ctx.globalAlpha=1;
    if(game.phase==='ready') {
      ctx.strokeStyle='#F9E9BD';ctx.lineWidth=2;ctx.globalAlpha=0.35+Math.sin(now/700)*0.1;
      ctx.beginPath();ctx.ellipse(ground.x,ground.y+2,radius+11,5,0,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.fillStyle='#D5D9BB';ctx.beginPath();ctx.arc(p.x,p.y,radius+1.5,0,TAU);ctx.fill();
    ctx.fillStyle='#FFFBEA';ctx.beginPath();ctx.arc(p.x-1,p.y-1,radius,0,TAU);ctx.fill();
    ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(p.x-radius*0.3,p.y-radius*0.35,radius*0.34,0,TAU);ctx.fill();
  }
}

function arrow(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,color:string,alpha:number) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(0,29);ctx.lineTo(0,-24);ctx.moveTo(-17,-8);ctx.lineTo(0,-27);ctx.lineTo(17,-8);ctx.stroke();ctx.restore();
}

/** Fixed teaching cues sit beside the ring lane; they never follow or decorate a real piece. */
export function drawSwingGuide(ctx:CanvasRenderingContext2D,stage:SwingState['stage']|'watch',power:number,ringPresent:boolean,now:number) {
  ctx.save();
  const through=stage==='backswing',watch=stage==='watch'||stage==='committed';
  const pulse=0.72+Math.sin(now/240)*0.18;
  const active='#F1D899',muted='#71947B';
  const label=watch?'IN PLAY':!ringPresent?'RETURN RING':through?'THROUGH':'YOUR SWING';
  ctx.font=gameFont(48);ctx.fillStyle=active;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,1640,857);
  ctx.strokeStyle='#486C52';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(1530,910);ctx.lineTo(1530,984);ctx.stroke();
  arrow(ctx,1450,947,Math.PI,through||watch?muted:active,through||watch?0.55:pulse);
  arrow(ctx,1610,947,-Math.PI/5,through?active:muted,through?pulse:0.65);
  arrow(ctx,1690,930,0,through?active:muted,through?pulse:0.65);
  arrow(ctx,1770,947,Math.PI/5,through?active:muted,through?pulse:0.65);
  ctx.fillStyle=through?muted:active;ctx.fillText('BACK',1450,1010);
  ctx.fillStyle=through?active:muted;ctx.fillText('SWING',1690,1010);
  if(power>0&&(through||watch)) {
    ctx.fillStyle='#315C43';ctx.fillRect(1395,890,430,7);
    ctx.fillStyle=active;ctx.fillRect(1395,890,430*clamp(power,0,1),7);
  }
  ctx.restore();
}

import { HOLE, holeFor, fairwayAt, terrainAt, clubFor, distanceToCup, type GolfState, type Hole } from './rules';
import { createTreeSprite, createGroundTexture, createSoftShadow } from './course-art';
import { sampleGreen } from './green';

/** Logical portrait coordinates. Main rotates this scene onto Board's native surface. */
export const COURSE_LAYOUT = {
  width: 1080,
  height: 1920,
  horizon: 430,
  swingTop: 1700,
  lane: { x: 380, y: 1570, width: 320, height: 210 },
} as const;
type SwingStage = 'settling' | 'ready' | 'backswing' | 'committed';

type Point = { x: number; z: number; y?: number };
type ScreenPoint = { x: number; y: number; scale: number; depth: number };
type Camera = { x: number; z: number; yaw: number; distance: number; height: number };
type TracePoint = Point & { time: number };
const TAU = Math.PI * 2;
const FOCAL = 1400;
const PITCH = 0.21;
const CENTER_Y = COURSE_LAYOUT.horizon + FOCAL * Math.tan(PITCH);
const ADDRESS_CAMERA = { distance: 17.2, height: 9.8 };
const PUTT_CAMERA = { distance: 16, height: 9.1 };
const FLIGHT_CAMERA = { distance: 26, height: 13.5 };
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
  return canvasLayer(1080, 1920, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 500);
    sky.addColorStop(0, '#4BABB8'); sky.addColorStop(0.62, '#B5DDD1'); sky.addColorStop(1, '#F2E5BD');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = '#F8EDC4'; ctx.beginPath(); ctx.arc(850, 280, 61, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E5EBD0';
    for (const [x, y, w, h] of [[130, 250, 160, 18], [276, 242, 106, 25], [740, 190, 145, 15]]) {
      ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
    }
    polygon(ctx, [{x:0,y:435},{x:0,y:370},{x:115,y:347},{x:235,y:378},{x:357,y:345},{x:462,y:368},{x:586,y:416},{x:715,y:388},{x:824,y:422},{x:1080,y:437}], '#83B7AC');
    const sea = ctx.createLinearGradient(0, 430, 0, 1300);
    sea.addColorStop(0, '#79B5AD'); sea.addColorStop(0.28, '#4B9D9C'); sea.addColorStop(1, '#236F7B');
    ctx.fillStyle = sea; ctx.fillRect(0, 435, 1080, 1485);
    ctx.strokeStyle = '#B5D3BC'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 22; i++) {
      const y = 447 + i * i * 0.9;
      const x = (i * 179) % 980;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 100 + i * 8, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Trees frame each route without covering its playable fairway or hazards. */
function treesFor(hole: Hole) {
  const trees: { x: number; z: number; h: number }[] = [];
  const { left, right, near, far } = hole.bounds;
  for (let z = near + 32, row = 0; z < far - 10; z += 43, row++) {
    for (const side of [-1, 1]) {
      const x = side < 0 ? left + 12 + row % 3 * 3 : right - 12 - row % 3 * 3;
      const depth = z + (side > 0 ? 17 : 0);
      const fairway = fairwayAt(depth, hole);
      if (depth < far - 5 && Math.abs(x - fairway.x) > fairway.width + 8 && terrainAt(x, depth, hole) === 'rough') {
        trees.push({ x, z: depth, h: 10 + row % 4 });
      }
    }
  }
  return trees;
}

type GreenCell = { points: Point[]; center: Point; color: string };

export class CourseView {
  private hole: Hole = HOLE;
  private camera: Camera = { x: 0, z: 0, yaw: 0, ...ADDRESS_CAMERA };
  private initialized = false;
  private sky: HTMLCanvasElement | null = null;
  private terrain: HTMLCanvasElement | null = null;
  private trees: HTMLCanvasElement[] = [];
  private terrainKey = '';
  private trace: TracePoint[] = [];
  private priorPhase = '';
  private landing: (Point & { at: number }) | null = null;
  private aim = 0;
  private selectedPutter = false;
  private shotElapsed = Infinity;
  private strokeIsPutt = false;
  private impactSent = false;
  private textures = new Map<Surface, CanvasPattern>();
  private softShadow: HTMLCanvasElement | null = null;
  private greenCells: GreenCell[] = [];
  private greenRead: HTMLCanvasElement | null = null;
  private greenReadKey = '';


  private loadScenery() {
    const photo = new Image();
    photo.onload = () => {
      this.sky = canvasLayer(1080, 1920, ctx => {
        ctx.fillStyle = '#32698A'; ctx.fillRect(0, 0, 1080, 1920);
        const scale = Math.max(1080 / photo.naturalWidth, 800 / photo.naturalHeight);
        ctx.drawImage(photo, (1080-photo.naturalWidth*scale)/2, COURSE_LAYOUT.horizon-photo.naturalHeight*0.60*scale, photo.naturalWidth*scale, photo.naturalHeight*scale);
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

  /** Kept for callers during the input transition; the physical piece now draws the whole club. */
  setSwing(_stage: SwingStage, _windup = 0): void {}

  setAim(angleRadians: number): void {
    this.aim = Number.isFinite(angleRadians) ? angleRadians : 0;
  }

  /** HUD directions follow the visible course as the camera turns toward a new lie. */
  get heading(): number { return this.camera.yaw; }

  /** Club selection changes the address pose without depending on the recommended club. */
  setPutting(putting: boolean): void { this.selectedPutter = putting; }

  /** A recognized physical return swing is contact; no separate animation delays the ball. */
  startStroke(_game: GolfState, putting: boolean): void {
    this.strokeIsPutt = putting; this.selectedPutter = putting; this.shotElapsed = 0; this.impactSent = false;
  }

  advanceSwing(dt: number, putting = this.selectedPutter): {impact:boolean;putting:boolean;ballDt:number} {
    const delta = Number.isFinite(dt) ? clamp(dt, 0, 1) : 0;
    this.selectedPutter = putting;
    if (!Number.isFinite(this.shotElapsed)) return { impact: false, putting, ballDt: delta };
    this.shotElapsed += delta;
    const impact = !this.impactSent && delta > 0;
    if (impact) this.impactSent = true;
    return { impact, putting: this.strokeIsPutt, ballDt: delta };
  }

  reset(game: GolfState) {
    this.hole = holeFor(game);
    this.buildGreenMesh();
    this.greenReadKey = '';
    const close = clubFor(game) === 'PUTTER';
    this.camera = {
      x: game.ball.x, z: game.ball.z,
      yaw: Math.atan2(this.hole.flag.x - game.ball.x, this.hole.flag.z - game.ball.z),
      ...(close ? PUTT_CAMERA : ADDRESS_CAMERA),
      height: (close ? PUTT_CAMERA : ADDRESS_CAMERA).height + this.surfaceHeight(game.ball),
    };
    this.initialized = true; this.trace = []; this.terrainKey = ''; this.landing = null;
    this.priorPhase = game.phase;
    this.shotElapsed=Infinity;this.aim=0;this.selectedPutter=close;this.impactSent=false;
  }

  private surfaceHeight(p: { x: number; z: number }): number {
    return terrainAt(p.x, p.z, this.hole) === 'green' ? sampleGreen(p.x, p.z, this.hole).height : 0;
  }

  private onSurface(p: Point): Point {
    return { ...p, y: (p.y ?? 0) + this.surfaceHeight(p) };
  }

  /** Small surface patches keep the actual rise and fall visible in perspective. */
  private buildGreenMesh(): void {
    this.greenCells = [];
    const g = this.hole.green, rings = 10, slices = 48;
    const point = (radius: number, angle: number): Point => {
      const x = g.x + g.rx * radius * Math.cos(angle), z = g.z + g.rz * radius * Math.sin(angle);
      return { x, z, y: sampleGreen(x, z, this.hole).height };
    };
    for (let ring = 0; ring < rings; ring++) for (let slice = 0; slice < slices; slice++) {
      const a = slice / slices * TAU, b = (slice + 1) / slices * TAU;
      const center = point((ring + 0.5) / rings, (a + b) / 2);
      const gradient = sampleGreen(center.x, center.z, this.hole).gradient;
      const light = clamp((-gradient.x * 0.75 - gradient.z * 0.65) * 260, -20, 20);
      const color = `rgb(${Math.round(151 + light)},${Math.round(175 + light)},${Math.round(99 + light)})`;
      this.greenCells.push({ center, color, points: [point(ring / rings, a), point((ring + 1) / rings, a),
        point((ring + 1) / rings, b), point(ring / rings, b)] });
    }
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
    return { x: 540 + side * scale, y: CENTER_Y + (down * Math.cos(PITCH) - forward * Math.sin(PITCH)) * scale, scale, depth };
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
    const minX = Math.min(...clipped.map(p => p.x)), maxX = Math.max(...clipped.map(p => p.x));
    const minZ = Math.min(...clipped.map(p => p.z)), maxZ = Math.max(...clipped.map(p => p.z));
    ctx.fillRect(minX*density,minZ*density,(maxX-minX)*density,(maxZ-minZ)*density);ctx.restore();
  }

  private ovalPoints(x: number, z: number, rx: number, rz: number, y = 0) {
    return Array.from({length:65}, (_,i) => ({x:x+Math.cos(i/64*TAU)*rx,z:z+Math.sin(i/64*TAU)*rz,y}));
  }

  private paintTerrain(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 1080, 1920);
    const b = this.hole.bounds;
    // The island's grass edge is the actual playable boundary; sand and cliff lie outside it.
    const rim = [{x:b.left-3,z:b.near-3,y:-2},{x:b.right+3,z:b.near-3,y:-2},{x:b.right+3,z:b.far+3,y:-2},{x:b.left-3,z:b.far+3,y:-2}];
    this.ground(ctx,rim,'#D3BC84');
    this.ground(ctx,[{x:b.left,z:b.near},{x:b.right,z:b.near},{x:b.right,z:b.far},{x:b.left,z:b.far}],'#426538','rough');
    const center = (z:number) => fairwayAt(z, this.hole).x;
    const width = (z:number) => fairwayAt(z, this.hole).width;
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
    const green=this.hole.green;
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx+1.8,green.rz+1.8),'#537F42');
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx+0.8,green.rz+0.8),'#BDD17C');
    for (const cell of [...this.greenCells].sort((a, b) => this.forward(b.center) - this.forward(a.center))) {
      this.ground(ctx, cell.points, cell.color);
    }
    // One texture pass keeps these small surface patches cheap when the camera moves.
    this.ground(ctx,this.ovalPoints(green.x,green.z,green.rx,green.rz),'rgba(0,0,0,0)','green');
    for (const sand of this.hole.bunkers) {
      this.ground(ctx,this.ovalPoints(sand.x,sand.z,sand.rx+0.65,sand.rz+0.65),'#355E39');
      this.ground(ctx,this.ovalPoints(sand.x,sand.z,sand.rx,sand.rz),'#C7B78C','sand');
      this.ground(ctx,this.ovalPoints(sand.x+0.4,sand.z+0.6,sand.rx-1.5,sand.rz-1.8),'#DED0A8','sand');
      // Rake marks follow each bunker's dimensions and stay in the cached ground layer.
      for(let i=0;i<6;i++) {
        const z=sand.z-sand.rz*0.5+i*sand.rz*0.2;
        this.ground(ctx,[{x:sand.x-sand.rx*0.4,z},{x:sand.x+sand.rx*0.4,z:z+0.5},
          {x:sand.x+sand.rx*0.4,z:z+0.65},{x:sand.x-sand.rx*0.4,z:z+0.15}],'#D7BC83');
      }
    }
    for (const water of this.hole.water) {
      // The blue surface uses the exact rule boundary; banks sit outside the penalty area.
      this.ground(ctx,this.ovalPoints(water.x,water.z,water.rx+1.3,water.rz+1.3),'#365E3E');
      this.ground(ctx,this.ovalPoints(water.x,water.z,water.rx+0.55,water.rz+0.55),'#B5BB88');
      this.ground(ctx,this.ovalPoints(water.x,water.z,water.rx,water.rz),'#337F91');
      this.ground(ctx,this.ovalPoints(water.x,water.z,water.rx*0.85,water.rz*0.85),'#3F9BAA');
      // Short reflected ribbons distinguish inland water from turf, without per-frame work.
      for (let i = -3; i <= 3; i++) {
        const z = water.z + i * water.rz * 0.22;
        const half = water.rx * Math.sqrt(1 - ((z-water.z)/water.rz)**2) * 0.68;
        const offset = (i % 2) * half * 0.15;
        this.ground(ctx,[{x:water.x-half+offset,z},{x:water.x+half+offset,z},
          {x:water.x+half+offset,z:z+0.20},{x:water.x-half+offset,z:z+0.20}],'#8FCAC5');
      }
    }
    const tee = this.hole.tee;
    this.ground(ctx,[{x:tee.x-3.5,z:tee.z-2},{x:tee.x+3.5,z:tee.z-2},
      {x:tee.x+3.5,z:tee.z+1},{x:tee.x-3.5,z:tee.z+1}],'#607D43','green');
    for(const x of [tee.x-3.4,tee.x+3.4]) this.ground(ctx,[{x:x-0.3,z:tee.z-1},{x:x+0.3,z:tee.z-1},
      {x:x+0.3,z:tee.z-0.4},{x:x-0.3,z:tee.z-0.4}],'#F8EBC4');
    const visible=treesFor(this.hole).map((t,i)=>({...t,index:i,p:this.project(t)})).filter(t=>t.p.depth>4).sort((a,b)=>b.p.depth-a.p.depth);
    for(const tree of visible) {
      const h=tree.h*tree.p.scale,w=h*(320/440);
      if(tree.p.x+w<0||tree.p.x-w>1080)continue;
      if(this.softShadow) {ctx.globalAlpha=0.48;ctx.drawImage(this.softShadow,tree.p.x-w*0.8,tree.p.y-h*0.04,w*1.6,h*0.13);ctx.globalAlpha=1;}
      ctx.drawImage(this.trees[tree.index%2],tree.p.x-w/2,tree.p.y-h,w,h);
    }
    // Subtle stakes communicate the out-of-bounds coastline without introducing a UI wall.
    for(let z=b.near+30;z<b.far;z+=40) for(const x of [b.left+0.4,b.right-0.4]) {
      const foot=this.project({x,z}),tip=this.project({x,z,y:1.1});
      if(foot.depth<4)continue;
      ctx.strokeStyle='#E8DFB7';ctx.lineWidth=clamp(foot.scale*0.10,1.5,4);
      ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
    }
  }

  draw(ctx: CanvasRenderingContext2D, game: GolfState, now: number, dt: number, preview = false) {
    if(!this.initialized || this.hole !== holeFor(game))this.reset(game);
    if(!this.sky) {
      this.sky=backdrop();this.trees=[createTreeSprite(0),createTreeSprite(1)];this.softShadow=createSoftShadow();
      for(const kind of ['fairway','rough','green','sand'] as const) {const pattern=ctx.createPattern(createGroundTexture(kind),'repeat');if(pattern)this.textures.set(kind,pattern);}
      this.terrain=canvasLayer(1080,1920,()=>{});this.loadScenery();
    }
    const moving=game.phase==='flight'||game.phase==='rolling';
    const close=this.selectedPutter;
    const framing=game.phase==='flight'?FLIGHT_CAMERA:close?PUTT_CAMERA:ADDRESS_CAMERA;
    const targetYaw=distanceToCup(game)>1.5 ? Math.atan2(this.hole.flag.x-game.ball.x,this.hole.flag.z-game.ball.z) : this.camera.yaw;
    if(game.phase==='ready' && (this.priorPhase==='flight'||this.priorPhase==='rolling')) this.shotElapsed=Infinity;
    // The camera follows after the physical hit; pause never consumes its easing time.
    const departure=clamp((this.shotElapsed-0.18)/0.2,0,1);
    const chase=moving?departure*departure*(3-2*departure):1;
    const blend=(1-Math.exp(-Math.max(0,dt)*(moving?2.5:4)))*chase;
    const c=this.camera;
    c.x=mix(c.x,game.ball.x,blend);c.z=mix(c.z,game.ball.z,blend);
    if(!moving)c.yaw+=angleDelta(c.yaw,targetYaw)*blend;
    c.distance=mix(c.distance,framing.distance,blend);
    const groundHeight = this.surfaceHeight(game.ball);
    c.height=mix(c.height,framing.height+groundHeight+game.ball.y*0.65,blend);
    if(!moving) {
      if(Math.abs(c.x-game.ball.x)<0.002)c.x=game.ball.x;
      if(Math.abs(c.z-game.ball.z)<0.002)c.z=game.ball.z;
      if(Math.abs(angleDelta(c.yaw,targetYaw))<0.0001)c.yaw=targetYaw;
      if(Math.abs(c.height-framing.height-groundHeight)<0.002)c.height=framing.height+groundHeight;
      if(Math.abs(c.distance-framing.distance)<0.002)c.distance=framing.distance;
    }
    const key=game.holeIndex+'|'+[c.x,c.z,c.yaw,c.distance,c.height].map(v=>v.toFixed(3)).join('|');
    if(key!==this.terrainKey){this.paintTerrain(this.terrain!.getContext('2d')!);this.terrainKey=key;}
    ctx.drawImage(this.sky,0,0);ctx.drawImage(this.terrain!,0,0);
    // Keep the fixed control surface below the course.
    const footer=ctx.createLinearGradient(0,1440,0,1530);
    footer.addColorStop(0,'rgba(18,57,44,0)');footer.addColorStop(1,'#12392C');
    ctx.fillStyle=footer;ctx.fillRect(0,1440,1080,90);
    ctx.fillStyle='#12392C';ctx.fillRect(0,1530,1080,390);
    ctx.save();ctx.beginPath();ctx.rect(0,0,1080,COURSE_LAYOUT.swingTop);ctx.clip();
    if (!preview && game.phase === 'ready' && (this.selectedPutter || distanceToCup(game) < 35)) this.drawGreenRead(ctx);
    if(!preview&&game.phase==='ready')this.drawAim(ctx,game,now);
    this.drawFlag(ctx,now);
    if(this.priorPhase==='flight'&&game.phase==='rolling')this.landing={x:game.ball.x,z:game.ball.z,at:now};
    this.priorPhase=game.phase;
    if(moving) {
      const previous=this.trace[this.trace.length-1];
      if(!previous||Math.hypot(game.ball.x-previous.x,game.ball.z-previous.z,game.ball.y+groundHeight-(previous.y??0))>0.4)
        this.trace.push({...this.onSurface(game.ball),time:now});
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
      const t=(now-this.landing.at)/520,p=this.project(this.onSurface(this.landing));
      ctx.globalAlpha=(1-t)*0.45;ctx.strokeStyle='#F5E4B4';ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(p.x,p.y,8+t*45,3+t*12,0,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    }
    if(game.phase!=='holed')this.drawBall(ctx,game,now);
    ctx.restore();
  }

  private drawGreenRead(ctx: CanvasRenderingContext2D): void {
    this.greenRead ??= canvasLayer(1080,1320,() => {});
    const key = this.terrainKey;
    if (key !== this.greenReadKey) {
      const layer = this.greenRead.getContext('2d')!;
      layer.clearRect(0,0,1080,1320);
      this.paintGreenRead(layer);
      this.greenReadKey = key;
    }
    ctx.drawImage(this.greenRead,0,0);
  }

  private paintGreenRead(ctx: CanvasRenderingContext2D): void {
    const g = this.hole.green;
    ctx.save();
    // Clip the reading marks to the real green, including the near camera plane.
    const edge = this.ovalPoints(g.x,g.z,g.rx,g.rz).filter(p => this.forward(p) >= 1).map(p => this.project(p));
    if (edge.length < 3) { ctx.restore(); return; }
    ctx.beginPath(); edge.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.clip();
    ctx.beginPath(); ctx.rect(48,430,984,880); ctx.clip();
    // The bending grid follows the same height surface as the rolling ball.
    ctx.strokeStyle = '#DDEAB4'; ctx.lineWidth = 2; ctx.globalAlpha = 0.26;
    for (const across of [false, true]) for (let offset = -20; offset <= 20; offset += 4.8) {
      let started = false;
      ctx.beginPath();
      for (let step = -24; step <= 24; step += 0.8) {
        const x = g.x + (across ? step : offset), z = g.z + (across ? offset : step);
        if (terrainAt(x,z,this.hole) !== 'green' || this.forward({x,z}) < 1) { started = false; continue; }
        const p = this.project(this.onSurface({x,z,y:0.015}));
        if (started) ctx.lineTo(p.x,p.y); else { ctx.moveTo(p.x,p.y); started = true; }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawAim(ctx:CanvasRenderingContext2D,game:GolfState,now:number) {
    const length=Math.min(Math.max(1,distanceToCup(game)-0.5),this.selectedPutter?14:32);
    if(length<=0)return;
    const yaw=Math.atan2(this.hole.flag.x-game.ball.x,this.hole.flag.z-game.ball.z)+this.aim;
    ctx.strokeStyle='#F8E8B6';ctx.lineCap='round';ctx.globalAlpha=0.48+Math.sin(now/800)*0.08;
    const step=length/8;
    for(let i=1;i<8;i++) {
      const a=this.project(this.onSurface({x:game.ball.x+Math.sin(yaw)*step*i,z:game.ball.z+Math.cos(yaw)*step*i,y:0.03}));
      const b=this.project(this.onSurface({x:game.ball.x+Math.sin(yaw)*step*(i+0.35),z:game.ball.z+Math.cos(yaw)*step*(i+0.35),y:0.03}));
      ctx.lineWidth=clamp(a.scale*0.09,2,4);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  private drawFlag(ctx:CanvasRenderingContext2D,now:number) {
    const base=this.project(this.onSurface(this.hole.flag));
    if(base.depth<2)return;
    const tip=this.project(this.onSurface({...this.hole.flag,y:5.4}));
    this.ground(ctx,this.ovalPoints(this.hole.flag.x,this.hole.flag.z,this.hole.cupRadius+0.08,this.hole.cupRadius+0.08).map(p => this.onSurface(p)),'#2A4C35');
    this.ground(ctx,this.ovalPoints(this.hole.flag.x,this.hole.flag.z,this.hole.cupRadius,this.hole.cupRadius).map(p => this.onSurface(p)),'#162F27');
    ctx.strokeStyle='#F7EFD7';ctx.lineWidth=clamp(base.scale*0.12,3,7);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
    const size=clamp(base.scale*2.8,31,90),wave=Math.sin(now/260)*size*0.06;
    polygon(ctx,[{x:tip.x,y:tip.y},{x:tip.x+size*0.55,y:tip.y+size*0.05+wave},{x:tip.x+size,y:tip.y+size*0.22},{x:tip.x+size*0.60,y:tip.y+size*0.40+wave},{x:tip.x,y:tip.y+size*0.36}],'#ED785C');
    polygon(ctx,[{x:tip.x,y:tip.y+size*0.36},{x:tip.x+size*0.60,y:tip.y+size*0.40+wave},{x:tip.x+size,y:tip.y+size*0.22},{x:tip.x+size*0.60,y:tip.y+size*0.49+wave},{x:tip.x,y:tip.y+size*0.44}],'#B95543');
  }

  private drawBall(ctx:CanvasRenderingContext2D,game:GolfState,now:number) {
    const p=this.project(this.onSurface({x:game.ball.x,z:game.ball.z,y:game.ball.y+0.2}));
    const ground=this.project(this.onSurface({x:game.ball.x,z:game.ball.z}));
    if(p.depth<1)return;
    const radius=clamp(p.scale*0.27,7,14);
    const shadow=this.project(this.onSurface({x:game.ball.x,z:game.ball.z}));
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

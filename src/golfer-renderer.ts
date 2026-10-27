import { sampleGolferRig, type Vec3, type RigFrame, type GolferRigPose } from './golfer-rig';

export interface GolferPose {
  footX:number;footY:number;ballX:number;ballY:number;scale:number;
  windup:number;followThrough:number;putting:boolean;alpha:number;
}
type Color=[number,number,number];
type Mesh={buffer:WebGLBuffer;count:number};
const SIZE=768,ORIGIN_X=340,ORIGIN_Y=690;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a:Vec3,s:number):Vec3=>({x:a.x*s,y:a.y*s,z:a.z*s});
const lerp=(a:Vec3,b:Vec3,t:number)=>add(a,mul(sub(b,a),t));
const norm=(a:Vec3)=>mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const UP={x:0,y:1,z:0},FORWARD={x:1,y:0,z:0},SIDE={x:0,y:0,z:1};
const SKIN:Color=[.76,.53,.36],POLO:Color=[.78,.35,.23],NAVY:Color=[.085,.135,.18],WHITE:Color=[.88,.87,.78];

/** One opaque articulated figure, rendered once and composited into the Board's 2D canvas.
 * Static geometry is uploaded once. Every pose clears color AND depth: no motion trail or image blends.
 * WebGL 1 is sufficient; returning false uses the existing continuous Canvas fallback.
 */
export class GolferRenderer {
  private canvas:HTMLCanvasElement|null=null;
  private gl:WebGLRenderingContext|null=null;
  private program:WebGLProgram|null=null;
  private meshes=new Map<string,Mesh>();
  private attempted=false;
  private key='';
  private uniforms:Record<string,WebGLUniformLocation|null>={};
  private position=0;
  private normal=1;

  private init():boolean {
    if(this.attempted)return !!this.gl;
    this.attempted=true;
    // Node boot tests have a Canvas2D stand-in, not a GPU context.
    if(typeof WebGLRenderingContext==='undefined')return false;
    const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;
    let gl:WebGLRenderingContext|null;
    try {gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});}
    catch {return false;}
    if(!gl)return false;
    const vertex=`attribute vec3 position;attribute vec3 normal;
      uniform mat4 model;uniform mat3 normals;uniform vec4 projection;
      varying vec3 n;varying vec3 point;
      void main(){vec3 p=(model*vec4(position,1.)).xyz;point=p;n=normalize(normals*normal);
        vec2 screen=vec2(${ORIGIN_X.toFixed(1)}+p.x*projection.x+p.z*projection.z*.5,${ORIGIN_Y.toFixed(1)}-p.y*projection.z+p.x*projection.y-p.z*projection.w);
        gl_Position=vec4(screen.x/${SIZE/2}.-1.,1.-screen.y/${SIZE/2}.,(p.z*.87+p.y*.21+p.x*.5)/8.,1.);}`;
    const fragment=`precision mediump float;varying vec3 n;varying vec3 point;uniform vec3 color;uniform float gloss;
      void main(){vec3 normal=normalize(n);vec3 sun=normalize(vec3(-.65,1.1,-.7));
        float diffuse=max(0.,dot(normal,sun));float sky=.14*(normal.y+1.);
        float spec=pow(max(0.,dot(normal,normalize(sun+vec3(-.5,.21,-.87)))),28.)*gloss;
        float cloth=1.+sin(point.y*165.+sin(point.z*80.))*sin(point.z*130.)*.009*(1.-gloss);
        vec3 light=color*(.48+sky+diffuse*.48)*cloth+vec3(spec);
        gl_FragColor=vec4(light,1.);}`;
    const shader=(kind:number,source:string)=>{const s=gl.createShader(kind)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;};
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    if(!vs||!fs)return false;
    const program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return false;}
    this.canvas=canvas;this.gl=gl;this.program=program;
    this.position=gl.getAttribLocation(program,'position');this.normal=gl.getAttribLocation(program,'normal');
    for(const name of ['model','normals','projection','color','gloss'])this.uniforms[name]=gl.getUniformLocation(program,name);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.gl=null;this.key='';});
    canvas.addEventListener('webglcontextrestored',()=>{this.attempted=false;this.meshes.clear();this.key='';});
    this.meshes.set('sphere',this.surface((u,v)=>{const a=u*Math.PI,b=v*Math.PI*2;return {x:Math.sin(a)*Math.cos(b),y:Math.cos(a),z:Math.sin(a)*Math.sin(b)};},24,32));
    this.meshes.set('tube',this.surface((u,v)=>({x:Math.cos(v*Math.PI*2),y:u,z:Math.sin(v*Math.PI*2)}),1,24));
    // A continuous fitted polo: flat hem, waist, chest, shoulder slope and neck opening.
    const shirt=[[0,.82],[.04,.86],[.25,.88],[.48,.95],[.73,1],[.88,1.02],[1,.4]];
    this.meshes.set('shirt',this.surface((u,v)=>{const k=Math.min(shirt.length-2,Math.floor(u*(shirt.length-1))),t=u*(shirt.length-1)-k;
      const y=shirt[k][0]+(shirt[k+1][0]-shirt[k][0])*t,r=shirt[k][1]+(shirt[k+1][1]-shirt[k][1])*t,a=v*Math.PI*2;
      const wrinkle=1+.012*Math.sin(a*7+y*31)*Math.sin(y*Math.PI);
      return {x:Math.cos(a)*r*wrinkle,y,z:Math.sin(a)*r*wrinkle};},36,32));
    this.meshes.set('limb',this.surface((u,v)=>{const r=(.8+.2*Math.sin(Math.PI*u))*(1-.16*u),a=v*Math.PI*2;return {x:r*Math.cos(a),y:u,z:r*Math.sin(a)};},12,24));
    return true;
  }

  private surface(point:(u:number,v:number)=>Vec3,rows:number,cols:number):Mesh {
    const data:number[]=[];
    const vertex=(u:number,v:number)=>{const p=point(u,v),eps=.0001;
      const du=sub(point(Math.min(1,u+eps),v),point(Math.max(0,u-eps),v)),dv=sub(point(u,v+eps),point(u,v-eps));
      let n=norm(cross(du,dv));
      // Lathe meshes run bottom to top; sphere runs north to south.
      if(n.x*p.x+n.z*p.z<0)n=mul(n,-1);
      data.push(p.x,p.y,p.z,n.x,n.y,n.z);
    };
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const u=r/rows,v=c/cols,U=(r+1)/rows,V=(c+1)/cols;
      vertex(u,v);vertex(U,v);vertex(u,V);vertex(u,V);vertex(U,v);vertex(U,V);
    }
    const gl=this.gl!,buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    return {buffer,count:data.length/6};
  }

  private shape(mesh:string,center:Vec3,rx:number,ry:number,rz:number,color:Color,frame?:RigFrame,gloss=.02) {
    const gl=this.gl!,f=frame?.forward??FORWARD,u=frame?.up??UP,s=frame?.side??SIDE;
    const m=new Float32Array([f.x*rx,f.y*rx,f.z*rx,0,u.x*ry,u.y*ry,u.z*ry,0,s.x*rz,s.y*rz,s.z*rz,0,center.x,center.y,center.z,1]);
    gl.uniformMatrix4fv(this.uniforms.model,false,m);
    gl.uniformMatrix3fv(this.uniforms.normals,false,new Float32Array([f.x/rx,f.y/rx,f.z/rx,u.x/ry,u.y/ry,u.z/ry,s.x/rz,s.y/rz,s.z/rz]));
    gl.uniform3fv(this.uniforms.color,color);gl.uniform1f(this.uniforms.gloss,gloss);
    const geometry=this.meshes.get(mesh)!;gl.bindBuffer(gl.ARRAY_BUFFER,geometry.buffer);
    gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.TRIANGLES,0,geometry.count);
  }

  private bone(a:Vec3,b:Vec3,radius:number,color:Color,depth=radius,mesh='limb',gloss=.02) {
    const delta=sub(b,a),length=Math.hypot(delta.x,delta.y,delta.z),up=norm(delta);
    const side=norm(cross(up,Math.abs(up.z)>.9?FORWARD:SIDE)),forward=norm(cross(up,side));
    this.shape(mesh,a,radius,length,depth,color,{center:a,up,side,forward},gloss);
  }
  private ellipsoid(center:Vec3,x:number,y:number,z:number,color:Color,frame?:RigFrame,gloss=.02){this.shape('sphere',center,x,y,z,color,frame,gloss);}

  private body(r:GolferRigPose) {
    const j=r.joints;
    // Feet and trousers; the trailing shoe rotates around its planted toe.
    for(const lead of [true,false]){
      const hip=lead?j.leadHip:j.trailHip,knee=lead?j.leadKnee:j.trailKnee,ankle=lead?j.leadAnkle:j.trailAnkle;
      const toe=lead?j.leadToe:j.trailToe,heel=lead?j.leadHeel:j.trailHeel;
      const forward=norm(sub(toe,heel)),side=norm(cross(forward,UP)),up=norm(cross(side,forward)),center=lerp(heel,toe,.52);
      const frame={center,forward,side,up};
      this.ellipsoid(add(center,mul(up,.035)),.17,.038,.066,[.15,.18,.18],frame);
      this.ellipsoid(add(center,mul(up,.067)),.155,.052,.062,WHITE,frame,.07);
      this.ellipsoid(add(center,add(mul(up,.108),mul(forward,-.015))),.066,.014,.045,[.65,.68,.65],frame);
      this.bone(hip,knee,.115,NAVY,.11);this.ellipsoid(knee,.074,.084,.078,NAVY);
      this.bone(knee,ankle,.077,NAVY,.074);
      // Pressed trouser creases follow the moving bones, without detached texture patches.
      this.bone(add(ankle,{x:-.061,y:0,z:0}),add(knee,{x:-.073,y:0,z:0}),.004,[.115,.17,.21],.003,'tube');
    }
    this.ellipsoid(j.pelvis,.145,.14,.208,NAVY,r.pelvis);
    const hem=add(j.pelvis,mul(r.torso.up,.025)),neckBase=add(j.neck,mul(r.torso.up,-.045));
    const torsoDelta=sub(neckBase,hem),torsoLength=Math.hypot(torsoDelta.x,torsoDelta.y,torsoDelta.z);
    this.shape('shirt',hem,.155,torsoLength,.255,POLO,r.torso);
    this.ellipsoid(add(hem,mul(r.torso.up,.015)),.144,.026,.215,[.085,.1,.1],r.torso);
    this.ellipsoid(add(hem,mul(r.torso.forward,.145)),.012,.024,.03,[.63,.6,.47],r.torso,.3);
    // Upper sleeves join the torso; tapered bare forearms meet a shared grip.
    for(const lead of [true,false]){
      const shoulder=lead?j.leadShoulder:j.trailShoulder,elbow=lead?j.leadElbow:j.trailElbow,wrist=lead?j.leadWrist:j.trailWrist;
      const sleeveEnd=lerp(shoulder,elbow,.55);
      this.ellipsoid(shoulder,.079,.082,.079,POLO);
      this.bone(shoulder,sleeveEnd,.081,POLO,.081);
      this.bone(sleeveEnd,elbow,.066,SKIN,.069);this.ellipsoid(elbow,.06,.064,.06,SKIN);
      this.bone(elbow,wrist,.058,SKIN,.052);
    }
    const collar=add(j.neck,mul(r.torso.up,-.027));
    this.ellipsoid(collar,.081,.028,.104,[.84,.41,.28],r.torso);
    for(const sign of [-1,1])this.ellipsoid(add(collar,add(mul(r.torso.forward,.067),mul(r.torso.side,.052*sign))),.038,.05,.039,[.8,.36,.24],r.torso);
    for(let i=0;i<3;i++)this.ellipsoid(add(j.neck,add(mul(r.torso.up,-.075-i*.035),mul(r.torso.forward,.144))),.005,.005,.005,[.81,.68,.55]);
    // Neck, jaw, face, ears, hair and a cream cap. The head continues to watch contact.
    this.bone(j.neck,j.head,.066,SKIN,.065);
    const h=r.head;
    this.ellipsoid(j.head,.095,.125,.087,SKIN,h,.04);
    this.ellipsoid(add(j.head,add(mul(h.forward,.05),mul(h.up,-.055))),.07,.06,.069,SKIN,h);
    this.ellipsoid(add(j.head,add(mul(h.forward,.089),mul(h.up,.005))),.023,.028,.018,[.78,.53,.35],h);
    for(const sign of [-1,1])this.ellipsoid(add(j.head,mul(h.side,sign*.088)),.025,.038,.016,SKIN,h);
    this.ellipsoid(add(j.head,add(mul(h.forward,-.012),mul(h.up,.07))),.1,.067,.094,[.23,.18,.13],h);
    for(const sign of [-1,1])this.ellipsoid(add(j.head,add(add(mul(h.forward,.081),mul(h.up,.03)),mul(h.side,.048*sign))),.008,.006,.009,[.15,.12,.09],h);
    const crown=add(j.head,mul(h.up,.1));
    this.ellipsoid(crown,.108,.065,.103,WHITE,h,.04);
    this.ellipsoid(add(crown,add(mul(h.forward,.102),mul(h.up,-.032))),.103,.012,.098,[.82,.81,.7],h);
    this.ellipsoid(add(crown,mul(h.up,.064)),.015,.01,.015,[.7,.71,.64],h);
    // The rigid club and attached hands are geometry in the same depth buffer as the golfer.
    this.bone(r.club.grip,r.club.head,.0065,[.64,.69,.71],.0065,'tube',.55);
    this.bone(r.club.grip,lerp(r.club.grip,r.club.head,.18),.012,[.09,.12,.12],.012,'tube');
    this.ellipsoid(r.club.head,r.club.length<.85?.055:.045,.023,.026,[.57,.63,.65],undefined,.6);
    this.ellipsoid(j.leadWrist,.03,.045,.034,WHITE,undefined,.06);
    this.ellipsoid(j.trailWrist,.03,.043,.032,SKIN,undefined,.05);
  }

  draw(ctx:CanvasRenderingContext2D,pose:GolferPose):boolean {
    if(pose.alpha<=0||pose.scale<=0)return true;
    try {if(!this.init())return false;}
    catch {this.gl=null;this.program=null;this.meshes.clear();return false;}
    const gl=this.gl!,rig=sampleGolferRig(pose.windup,pose.followThrough,pose.putting);
    // Anchor the local ball and soles to their course projections; all other joints share this transform.
    const height=132*pose.scale,px=(pose.ballX-pose.footX)/rig.ball.x,py=(pose.ballY-pose.footY+rig.ball.y*height)/rig.ball.x;
    const key=[pose.windup,pose.followThrough,pose.putting,height,px,py].join(':');
    if(key!==this.key){
      gl.viewport(0,0,SIZE,SIZE);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      gl.enableVertexAttribArray(this.position);gl.enableVertexAttribArray(this.normal);
      gl.uniform4f(this.uniforms.projection,px,py,height,height*.24);
      this.body(rig);this.key=key;
    }
    ctx.save();ctx.globalAlpha=pose.alpha;ctx.drawImage(this.canvas!,pose.footX-ORIGIN_X,pose.footY-ORIGIN_Y);ctx.restore();
    return true;
  }
}

/** Aligned photographic keyframes: preserve complete anatomy while blending nearby poses. */
export interface GolferPose {
  footX:number;footY:number;ballX:number;ballY:number;scale:number;
  windup:number;followThrough:number;putting:boolean;alpha:number;
}
type Frame={foot:[number,number];grip:[number,number];headY:number};
const CELL=362,BUFFER_W=520,BUFFER_H=460,OX=220,OY=420;
const FRAMES:Frame[]=[
  {foot:[177,356],grip:[219,205],headY:48},
  {foot:[171,357],grip:[232,208],headY:63},
  {foot:[171,357],grip:[267,162],headY:65},
  {foot:[182,357],grip:[145,81],headY:65},
  {foot:[189,360],grip:[193,19],headY:60},
  {foot:[195,361],grip:[139,59],headY:65},
  {foot:[172,360],grip:[222,210],headY:59},
  {foot:[176,361],grip:[283,128],headY:56},
  {foot:[200,343],grip:[136,42],headY:40},
  {foot:[220,343],grip:[201,18],headY:48},
  {foot:[215,343],grip:[201,26],headY:49},
  {foot:[213,343],grip:[201,26],headY:49},
];
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const heightScale=(frame:Frame)=>308/(frame.foot[1]-frame.headY);
const FOLLOW=[{at:0,index:0},{at:.08,index:6},{at:.28,index:7},{at:.5,index:8},{at:.72,index:9},{at:.9,index:10},{at:1,index:11}];

export class GolferRenderer {
  private layer:HTMLCanvasElement|null=null;
  private key='';
  private image:CanvasImageSource|null=null;

  private paint(ctx:CanvasRenderingContext2D,image:CanvasImageSource,index:number,weight:number) {
    if(weight<=0)return;
    const f=FRAMES[index],ys=heightScale(f),top=index===11?10:0;
    ctx.globalAlpha=weight;
    ctx.drawImage(image,index%4*CELL,Math.floor(index/4)*CELL+top,CELL,CELL-top,
      OX-f.foot[0],OY+(top-f.foot[1])*ys,CELL,(CELL-top)*ys);
  }

  draw(ctx:CanvasRenderingContext2D,image:CanvasImageSource,pose:GolferPose):void {
    if(pose.alpha<=0||pose.scale<=0)return;
    const w=clamp(pose.windup,0,1),f=clamp(pose.followThrough,0,1);
    let a=0,b=0,t=0;
    if(!pose.putting) {
      if(f>0) {
        const right=FOLLOW.findIndex(k=>k.at>=f),i=Math.max(1,right);
        a=FOLLOW[i-1].index;b=FOLLOW[i].index;t=(f-FOLLOW[i-1].at)/(FOLLOW[i].at-FOLLOW[i-1].at);
      } else {const position=w*4;a=Math.floor(position);b=Math.min(4,a+1);t=position-a;}
    }
    if(!this.layer){this.layer=document.createElement('canvas');this.layer.width=BUFFER_W;this.layer.height=BUFFER_H;}
    const key=[a,b,Math.round(t*1024)].join(':');
    if(key!==this.key||image!==this.image) {
      const out=this.layer.getContext('2d')!;out.clearRect(0,0,BUFFER_W,BUFFER_H);
      out.globalCompositeOperation='source-over';this.paint(out,image,a,1-t);
      // Weighted premultiplied color preserves opacity where aligned silhouettes overlap.
      out.globalCompositeOperation='lighter';this.paint(out,image,b,t);
      out.globalCompositeOperation='source-over';out.globalAlpha=1;
      this.key=key;this.image=image;
    }
    const s=pose.scale*245/333;
    const localGrip=(i:number)=>({x:FRAMES[i].grip[0]-FRAMES[i].foot[0],y:(FRAMES[i].grip[1]-FRAMES[i].foot[1])*heightScale(FRAMES[i])});
    const ga=localGrip(a),gb=localGrip(b),neutral=localGrip(0);
    const rock=pose.putting?(f-w)*0.014:0;
    const gx=mix(ga.x,gb.x,t),gy=mix(ga.y,gb.y,t);
    const grip={x:pose.footX+(gx*Math.cos(rock)-gy*Math.sin(rock))*s,y:pose.footY+(gx*Math.sin(rock)+gy*Math.cos(rock))*s};
    const address={x:pose.footX+neutral.x*s,y:pose.footY+neutral.y*s};
    const length=Math.hypot(pose.ballX-address.x,pose.ballY-address.y);
    const baseAngle=Math.atan2(pose.ballY-address.y,pose.ballX-address.x);
    // A continuous wrist release follows the same progress as the body; contact is exact.
    const angle=mix(baseAngle,-3.65,f>0?f:w);
    let end={x:grip.x+Math.cos(angle)*length,y:grip.y+Math.sin(angle)*length};
    if(pose.putting)end={x:pose.ballX+(f-w)*34*s,y:pose.ballY-Math.abs(f-w)*3*s};
    ctx.save();ctx.globalAlpha=pose.alpha;ctx.lineCap='round';
    ctx.strokeStyle='#C4CEC8';ctx.lineWidth=Math.max(1.5,2.7*s);ctx.beginPath();ctx.moveTo(grip.x,grip.y);ctx.lineTo(end.x,end.y);ctx.stroke();
    ctx.strokeStyle='#27352F';ctx.lineWidth=Math.max(2,4.7*s);ctx.beginPath();ctx.moveTo(grip.x,grip.y);ctx.lineTo(mix(grip.x,end.x,.14),mix(grip.y,end.y,.14));ctx.stroke();
    ctx.save();ctx.translate(end.x,end.y);ctx.rotate(angle-Math.PI/2);ctx.fillStyle='#DCE2DD';ctx.fillRect(-8*s,-3*s,17*s,7*s);ctx.fillStyle='#677971';ctx.fillRect(-8*s,2*s,17*s,3*s);ctx.restore();
    ctx.translate(pose.footX,pose.footY);ctx.rotate(rock);ctx.drawImage(this.layer,-OX*s,-OY*s,BUFFER_W*s,BUFFER_H*s);ctx.restore();
  }
}

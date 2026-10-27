import { gameFont } from './runtime';

export interface Box { x:number; y:number; width:number; height:number }
export type Motion = 'place' | 'slide' | 'lift' | 'putt';
export interface HowToStep { motion:Motion; text:string }
export const HOW_TO_STEPS:HowToStep[] = [
  {motion:'place',text:'Place your ring'},
  {motion:'slide',text:'Back, then through'},
  {motion:'putt',text:'Find the cup'},
];
export const HOW_TO_BUTTON:Box = {x:1432,y:892,width:440,height:140};
export const BACK_BUTTON:Box = {x:48,y:892,width:280,height:140};
export const hit=(box:Box,x:number,y:number)=>x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
let ringArt:CanvasImageSource|null=null;
/** Main loads the canonical, upright Bloogs render once; help does not invent piece art. */
export function setRingArt(image:CanvasImageSource|null){ringArt=image;}

function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

export function drawButton(ctx:CanvasRenderingContext2D,box:Box,label:string){
  ctx.save();
  ctx.fillStyle='#F1E4BC';rounded(ctx,box.x,box.y+5,box.width,box.height-5,14);ctx.fill();
  ctx.fillStyle='#F8EFD4';rounded(ctx,box.x,box.y,box.width,box.height-7,14);ctx.fill();
  ctx.strokeStyle='#C7B77D';ctx.lineWidth=2;ctx.stroke();
  ctx.font=gameFont(48);ctx.fillStyle='#204834';ctx.textAlign='center';ctx.textBaseline='middle';
  // Keep 48px text; long button labels wrap instead of becoming unreadable in play.
  const words=label.split(' ');
  if(ctx.measureText(label).width>box.width-38&&words.length>1){
    const split=Math.ceil(words.length/2);
    ctx.fillText(words.slice(0,split).join(' '),box.x+box.width/2,box.y+box.height/2-25);
    ctx.fillText(words.slice(split).join(' '),box.x+box.width/2,box.y+box.height/2+25);
  }else ctx.fillText(label,box.x+box.width/2,box.y+box.height/2-3);
  ctx.restore();
}

function text(ctx:CanvasRenderingContext2D,label:string,x:number,y:number,size=48,color='#F7EDD2'){
  ctx.font=gameFont(size);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y);
}

function demoArrow(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,alpha=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;ctx.strokeStyle='#F2CF83';ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(0,27);ctx.lineTo(0,-28);ctx.moveTo(-18,-11);ctx.lineTo(0,-30);ctx.lineTo(18,-11);ctx.stroke();ctx.restore();
}

function demoRing(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,alpha=1){
  if(!ringArt)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(ringArt,x-size/2,y-size/2,size,size);ctx.restore();
}

function drawDemo(ctx:CanvasRenderingContext2D,motion:Motion,x:number,y:number,now:number){
  const cycle=(now%3400)/3400;
  ctx.save();
  if(motion==='place'){
    ctx.strokeStyle='#659074';ctx.lineWidth=3;ctx.setLineDash([10,10]);
    rounded(ctx,x-122,y-90,244,210,18);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#72946D';ctx.fillRect(x-170,y+134,340,8);
    const arrival=Math.min(1,cycle/0.28),size=150+(1-arrival)*55;
    demoRing(ctx,x,y+15-(1-arrival)*55,size,arrival);
    if(cycle>0.28&&cycle<0.60){const t=(cycle-0.28)/0.32;ctx.globalAlpha=(1-t)*0.7;ctx.strokeStyle='#F1D899';ctx.beginPath();ctx.arc(x,y+15,85+t*45,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }else if(motion==='slide'){
    // Demo-only canonical art, upright throughout a continuous back-and-forward stroke.
    const back=cycle<0.44;
    let dy=-37;
    if(cycle<0.12)dy=-37;
    else if(cycle<0.44)dy=-37+(cycle-0.12)/0.32*108;
    else if(cycle<0.62)dy=71-(cycle-0.44)/0.18*155;
    else dy=-84;
    demoArrow(ctx,x-160,y+45,Math.PI,back?1:0.28);
    demoArrow(ctx,x+153,y-24,0,back?0.28:1);
    demoRing(ctx,x,y+dy,140);
    text(ctx,back?'BACK':'THROUGH',x,y+168,40,'#F1D899');
  }else{
    ctx.fillStyle='#82AB5E';ctx.beginPath();ctx.ellipse(x,y+38,190,92,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#214431';ctx.beginPath();ctx.ellipse(x+90,y+20,16,6,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#F8EDD1';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+90,y+20);ctx.lineTo(x+90,y-125);ctx.stroke();
    ctx.fillStyle='#ECB25B';ctx.beginPath();ctx.moveTo(x+90,y-125);ctx.lineTo(x+145,y-109);ctx.lineTo(x+90,y-91);ctx.closePath();ctx.fill();
    const t=Math.min(1,cycle/0.67),ballX=x-126+t*216,ballY=y+59-t*39;
    if(t<1){ctx.fillStyle='rgba(30,64,34,0.4)';ctx.beginPath();ctx.ellipse(ballX+3,ballY+4,12,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#FFFBE9';ctx.beginPath();ctx.arc(ballX,ballY-4,11,0,Math.PI*2);ctx.fill();}
    else{ctx.strokeStyle='#F2D48C';ctx.globalAlpha=1-(cycle-0.67)/0.33;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x+90,y+20,18+(cycle-0.67)*100,7+(cycle-0.67)*30,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }
  ctx.restore();
}

/** Optional teaching: the real piece, the continuous stroke, then the golfing consequence. */
export function drawHowTo(ctx:CanvasRenderingContext2D,now:number,steps:HowToStep[]=HOW_TO_STEPS){
  ctx.save();ctx.fillStyle='#12392C';ctx.fillRect(0,0,1920,1080);
  text(ctx,'A LITTLE TOUCH. A GREAT SHOT.',960,121,64);
  text(ctx,'Keep hold of the ring. Let the stroke do the work.',960,206,40,'#AEC5A3');
  const gap=24,margin=64,width=(1920-margin*2-gap*(steps.length-1))/steps.length;
  steps.forEach((step,i)=>{
    const left=margin+i*(width+gap),cx=left+width/2;
    ctx.fillStyle='#1B4935';rounded(ctx,left,284,width,532,20);ctx.fill();
    ctx.strokeStyle='#42694B';ctx.lineWidth=2;ctx.stroke();
    text(ctx,String(i+1).padStart(2,'0'),left+58,332,36,'#B5C895');
    drawDemo(ctx,step.motion,cx,490,now+i*150);
    text(ctx,step.text,cx,710,48);
    const captions=['At your edge of the Board','Faster slide. Stronger shot.','Fewer strokes is better.'];
    text(ctx,captions[i]??'',cx,771,32,'#B1C5A4');
  });
  drawButton(ctx,BACK_BUTTON,'BACK');
  text(ctx,'Angle the forward slide to aim left or right.',1100,955,40,'#C8D5B3');
  ctx.restore();
}

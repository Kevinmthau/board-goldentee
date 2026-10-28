import { gameFont } from './runtime';
export interface Box { x: number; y: number; width: number; height: number }
export const BACK_BUTTON: Box = {x: 340, y: 1720, width: 400, height: 130};
export const hit = (box: Box, x: number, y: number) => x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
let pieceArt: CanvasImageSource | null = null;
export function setPieceArt(image: CanvasImageSource | null) { pieceArt = image; }

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


function text(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, size = 48, color = '#F7EDD2') {
  ctx.font = gameFont(size); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}
/** Product art stays upright. The separate club demonstration shows the twist's consequence. */
export function drawHowTo(ctx: CanvasRenderingContext2D, now: number) {
  ctx.save(); ctx.fillStyle = '#12392C'; ctx.fillRect(0, 0, 1080, 1920);
  text(ctx, 'YOUR PLAYER. YOUR SWING.', 540, 145, 56);
  text(ctx, 'Keep hold of the piece as you turn.', 540, 235, 40, '#AEC5A3');
  const steps = [
    ['1  PLACE YOUR PLAYER', 'Hold still on the open grass.'],
    ['2  TURN BACK, THEN HIT', 'Return the club to the ball to strike.'],
    ['3  READ THE GREEN', 'Green arrows show the downhill break.'],
  ];
  for (let i = 0; i < steps.length; i++) {
    const y = 320 + i * 440;
    ctx.fillStyle = '#1B4935'; rounded(ctx, 64, y, 952, 394, 20); ctx.fill();
    text(ctx, steps[i][0], 540, y + 60, 48, '#F1D899');
    text(ctx, steps[i][1], 540, y + 340, 40, '#D9E5C7');
    if (i === 0) {
      if (pieceArt) ctx.drawImage(pieceArt, 450, y + 100, 180, 190);
      else text(ctx, 'SPORTS PLAYER', 540, y + 200);
    } else if (i === 1) {
      const t = (now % 3000) / 3000;
      const windup = t < .55 ? Math.min(1, t / .4) : Math.max(0, 1 - (t - .55) / .15);
      const angle = -.5 - windup * 1.5;
      const grip = {x: 500, y: y + 140};
      const head = {x: grip.x + Math.cos(angle) * 110, y: grip.y - Math.sin(angle) * 110};
      ctx.strokeStyle = '#CAD5CE'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(grip.x, grip.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.fillStyle = '#EFF2DD'; ctx.fillRect(head.x - 16, head.y - 5, 32, 12);
      text(ctx, t < .55 ? '↶' : '↷', 740, y + 200, 100, '#F1D899');
      text(ctx, 'Larger turn = more power', 540, y + 285, 40, '#B1C5A4');
    } else {
      text(ctx, 'PUTTER: SMALL TURN, GENTLE RETURN', 540, y + 145, 40, '#F1D899');
      text(ctx, 'Aim in 0.25° steps. Watch the feet.', 540, y + 215, 40, '#D9E5C7');
      text(ctx, 'Tap CLUB BAG to choose from 12 clubs.', 540, y + 290, 40, '#B1C5A4');
    }
  }
  text(ctx, 'NINE HOLES  /  PAR 36  /  12 CLUBS', 540, 1650, 40, '#F1D899');
  drawButton(ctx, BACK_BUTTON, 'BACK'); ctx.restore();
}

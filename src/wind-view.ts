import { gameFont } from './runtime';

/** Wind points toward its destination; positive screen y points toward the player. */
export function windOnScreen(wind: {x: number; z: number}, cameraHeading: number) {
  const c = Math.cos(cameraHeading), s = Math.sin(cameraHeading);
  return {x: wind.x * c - wind.z * s, y: -(wind.x * s + wind.z * c)};
}

export function drawWind(ctx: CanvasRenderingContext2D, wind: {x: number; z: number}, cameraHeading: number) {
  ctx.save();
  const speed = Math.hypot(wind.x, wind.z);
  ctx.strokeStyle = '#F1D58B'; ctx.fillStyle = '#F1D58B'; ctx.lineWidth = 6;
  const direction = windOnScreen(wind, cameraHeading);
  ctx.save(); ctx.translate(750, 1838);
  if (speed > 0) {
    ctx.rotate(Math.atan2(direction.y, direction.x));
    ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(12, -17); ctx.lineTo(12, 17); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.font = gameFont(48); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#FFF8E4';
  ctx.fillText('WIND', 714, 1780);
  ctx.fillText(speed < 0.5 ? 'CALM' : `${Math.round(speed)} MPH`, 806, 1840);
  ctx.restore();
}

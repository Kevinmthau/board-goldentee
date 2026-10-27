/** Original procedural course artwork. Call once and keep the returned canvases. */
type GroundKind = 'fairway' | 'rough' | 'green' | 'sand';
type Crown = { x: number; y: number; rx: number; ry: number; light: number };
const TAU = Math.PI * 2;

function randomSource(seed: number): () => number {
  let value = (seed | 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function crownPath(ctx: CanvasRenderingContext2D, crown: Crown, random: () => number) {
  ctx.beginPath();
  const points = 37;
  for (let i = 0; i < points; i++) {
    const angle = i / points * TAU;
    const radius = 0.85 + random() * 0.22;
    const x = crown.x + Math.cos(angle) * crown.rx * radius;
    const y = crown.y + Math.sin(angle) * crown.ry * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 320 × 440, transparent. Irregular wind-shaped cypress, trunk anchored at (160, 432). */
export function createTreeSprite(variant: number): HTMLCanvasElement {
  const { canvas, ctx } = surface(320, 440);
  const random = randomSource(0x1eaf93 ^ Math.imul((variant | 0) + 1, 7919));
  const lean = (random() - 0.5) * 22;
  const mirror = variant % 2 === 0 ? 1 : -1;
  const crowns: Crown[] = [
    { x: 151, y: 59, rx: 28, ry: 36, light: 1 },
    { x: 130, y: 88, rx: 40, ry: 35, light: 1 },
    { x: 175, y: 102, rx: 48, ry: 38, light: 0.8 },
    { x: 102, y: 127, rx: 53, ry: 39, light: 0.7 },
    { x: 209, y: 142, rx: 58, ry: 36, light: 0.65 },
    { x: 150, y: 148, rx: 60, ry: 45, light: 0.8 },
    { x: 66, y: 177, rx: 42, ry: 35, light: 0.6 },
    { x: 249, y: 189, rx: 45, ry: 33, light: 0.55 },
    { x: 107, y: 207, rx: 62, ry: 44, light: 0.55 },
    { x: 197, y: 213, rx: 65, ry: 45, light: 0.5 },
    { x: 146, y: 254, rx: 65, ry: 40, light: 0.4 },
    { x: 223, y: 263, rx: 43, ry: 30, light: 0.4 },
    { x: 88, y: 273, rx: 40, ry: 27, light: 0.4 },
  ].map(c => ({
    ...c,
    x: 160 + (c.x - 160) * mirror + lean * (1 - c.y / 440) + (random() - 0.5) * 13,
    y: c.y + (random() - 0.5) * 13,
    rx: c.rx * (0.88 + random() * 0.2),
    ry: c.ry * (0.88 + random() * 0.2),
  }));

  // Deep foliage lies behind the branching skeleton; small openings retain their depth.
  ctx.fillStyle = '#1C3024';
  for (const crown of crowns) { crownPath(ctx, crown, random); ctx.fill(); }

  function branch(points: number[][], width: number) {
    const trace = () => {
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3E3C2D'; ctx.lineWidth = width; trace(); ctx.stroke();
    ctx.save(); ctx.translate(-width * 0.2, 0);
    ctx.strokeStyle = '#7C7658'; ctx.lineWidth = width * 0.32; trace(); ctx.stroke();
    ctx.restore();
  }
  const bend = 156 + lean * 0.4;
  branch([[160, 432], [154, 385], [bend, 328], [bend - 10, 273], [162 + lean, 196], [151 + lean, 85]], 16);
  branch([[bend, 335], [116, 296], [81, 254], [51, 219]], 8);
  branch([[bend - 7, 281], [197, 254], [230, 213], [269, 185]], 8);
  branch([[bend, 325], [198, 304], [235, 276]], 6);
  branch([[157, 228], [112, 201], [79, 166]], 6);
  branch([[164, 190], [204, 160], [226, 131]], 5);
  branch([[125, 296], [116, 258], [128, 220]], 4);
  branch([[204, 247], [201, 210], [187, 186]], 4);
  for (let i = 0; i < 20; i++) {
    const y = 325 + random() * 99;
    ctx.strokeStyle = i % 3 ? 'rgba(35,36,26,0.42)' : 'rgba(193,174,119,0.28)';
    ctx.lineWidth = 0.5 + random();
    ctx.beginPath(); ctx.moveTo(151 + random() * 13, y);
    ctx.lineTo(151 + random() * 13, y - 7 - random() * 21); ctx.stroke();
  }

  // Each crown has a lit upper-left face, dark underside, and a broken needle silhouette.
  for (const crown of crowns) {
    const shade = ctx.createLinearGradient(crown.x - crown.rx, crown.y - crown.ry, crown.x + crown.rx, crown.y + crown.ry);
    shade.addColorStop(0, crown.light > 0.6 ? '#658064' : '#50694D');
    shade.addColorStop(0.4, '#3E6045');
    shade.addColorStop(0.72, '#2B4934');
    shade.addColorStop(1, '#1B3428');
    ctx.fillStyle = shade;
    crownPath(ctx, crown, random); ctx.fill();
    const count = Math.round(crown.rx * crown.ry / 9);
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU;
      const radius = Math.sqrt(random());
      const x = crown.x + Math.cos(angle) * crown.rx * radius;
      const y = crown.y + Math.sin(angle) * crown.ry * radius;
      const topLight = (crown.y - y) / crown.ry * 0.4 + (crown.x - x) / crown.rx * 0.22;
      const light = topLight + random() * 0.8;
      ctx.strokeStyle = light > 0.65 ? 'rgba(134,155,109,0.66)' : light > 0.15 ?
        'rgba(84,115,72,0.68)' : 'rgba(19,48,33,0.62)';
      ctx.lineWidth = 0.6 + random() * 0.6;
      const length = 1.3 + random() * 3.5;
      const tilt = -0.7 + random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + tilt, y - length);
      ctx.moveTo(x, y - length * 0.2); ctx.lineTo(x - length * 0.55 + tilt, y - length * 0.65);
      ctx.moveTo(x, y - length * 0.35); ctx.lineTo(x + length * 0.45 + tilt, y - length * 0.9);
      ctx.stroke();
    }
  }
  // Fine sparse sprays soften the outline without a blur operation or a solid oval crown.
  for (const crown of crowns) {
    for (let i = 0; i < 35; i++) {
      const angle = random() * TAU;
      const x = crown.x + Math.cos(angle) * crown.rx * 0.97;
      const y = crown.y + Math.sin(angle) * crown.ry * 0.97;
      ctx.strokeStyle = i % 3 ? 'rgba(41,75,47,0.82)' : 'rgba(110,137,89,0.7)';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * (2 + random() * 5), y + Math.sin(angle) * (2 + random() * 4));
      ctx.stroke();
    }
  }
  return canvas;
}

/**
 * 256 × 256 repeatable, neutral-gray detail. Overlay with soft-light (about 0.45 alpha),
 * or multiply at a low alpha. The caller supplies the actual course color underneath.
 */
export function createGroundTexture(kind: GroundKind): HTMLCanvasElement {
  const { canvas, ctx } = surface(256, 256);
  const index = ['fairway', 'rough', 'green', 'sand'].indexOf(kind);
  const random = randomSource(0x741f93 ^ Math.imul(index + 1, 3593));
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 256, 256);
  // Every large-scale mark wraps at tile edges, avoiding obvious rectangular seams.
  for (let i = 0; i < 44; i++) {
    const x = random() * 256, y = random() * 256, radius = 8 + random() * 38;
    const light = i % 2 ? 'rgba(205,205,205,0.10)' : 'rgba(48,48,48,0.09)';
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      if (x + dx + radius < 0 || x + dx - radius > 256 || y + dy + radius < 0 || y + dy - radius > 256) continue;
      const patch = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
      patch.addColorStop(0, light); patch.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = patch; ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
    }
  }
  const grain = kind === 'green' ? 15500 : kind === 'sand' ? 12500 : 8500;
  for (let i = 0; i < grain; i++) {
    const value = Math.round(75 + random() * 108);
    ctx.fillStyle = `rgba(${value},${value},${value},${kind === 'green' ? 0.25 : 0.36})`;
    const size = kind === 'green' ? 0.45 + random() * 0.75 : 0.6 + random() * 1.2;
    ctx.fillRect(random() * 256, random() * 256, size, size);
  }
  if (kind === 'sand') {
    for (let i = 0; i < 28; i++) {
      const y = i * 10.1 + random() * 2;
      ctx.strokeStyle = i % 2 ? 'rgba(72,72,72,0.13)' : 'rgba(220,220,220,0.17)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-5, y);
      ctx.bezierCurveTo(70, y + 1.5, 185, y - 1.5, 261, y); ctx.stroke();
    }
  } else {
    const count = kind === 'rough' ? 7800 : kind === 'fairway' ? 6100 : 3400;
    const maxLength = kind === 'rough' ? 6 : kind === 'fairway' ? 2.6 : 0.9;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = random() * 256, y = random() * 256;
      const length = 0.7 + random() * maxLength;
      const lean = (random() - 0.5) * length;
      ctx.strokeStyle = i % 3 ? 'rgba(57,57,57,0.21)' : 'rgba(217,217,217,0.26)';
      ctx.lineWidth = 0.45 + random() * 0.55;
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
        const xx = x + dx, yy = y + dy;
        if (xx < -maxLength || xx > 256 + maxLength || yy < 0 || yy > 256 + maxLength) continue;
        ctx.beginPath(); ctx.moveTo(xx, yy);
        ctx.quadraticCurveTo(xx + lean * 0.25, yy - length * 0.65, xx + lean, yy - length);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

/** 256 × 128 transparent soft ground shadow, centered at (128, 64). */
export function createSoftShadow(): HTMLCanvasElement {
  const { canvas, ctx } = surface(256, 128);
  ctx.scale(2, 1);
  const fade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, 'rgba(16,27,17,0.52)');
  fade.addColorStop(0.22, 'rgba(16,27,17,0.42)');
  fade.addColorStop(0.5, 'rgba(16,27,17,0.21)');
  fade.addColorStop(0.78, 'rgba(16,27,17,0.06)');
  fade.addColorStop(1, 'rgba(16,27,17,0)');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

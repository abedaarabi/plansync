export const WALK_PLAN_MAP_PX = 132;

const PAD = 10;

export type WalkPlanBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type WalkPlanMapState = {
  playerX: number;
  playerZ: number;
  heading: number;
  bounds: WalkPlanBounds | null;
};

function worldToMap(
  x: number,
  z: number,
  bounds: WalkPlanBounds,
  mapPx: number,
): { x: number; y: number } {
  const inner = mapPx - PAD * 2;
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.001);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 0.001);
  const scale = Math.min(inner / spanX, inner / spanZ);
  const drawW = spanX * scale;
  const drawH = spanZ * scale;
  const ox = PAD + (inner - drawW) / 2;
  const oy = PAD + (inner - drawH) / 2;
  return {
    x: ox + (x - bounds.minX) * scale,
    y: oy + (bounds.maxZ - z) * scale,
  };
}

export function drawWalkPlanMap(
  ctx: CanvasRenderingContext2D,
  mapPx: number,
  state: WalkPlanMapState,
): void {
  ctx.clearRect(0, 0, mapPx, mapPx);
  ctx.fillStyle = "#eef1f5";
  ctx.fillRect(0, 0, mapPx, mapPx);

  if (!state.bounds) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Walk mode", mapPx / 2, mapPx / 2 - 6);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("WASD to move", mapPx / 2, mapPx / 2 + 8);
    return;
  }

  const bounds = state.bounds;
  const tl = worldToMap(bounds.minX, bounds.maxZ, bounds, mapPx);
  const br = worldToMap(bounds.maxX, bounds.minZ, bounds, mapPx);
  const footprintW = br.x - tl.x;
  const footprintH = br.y - tl.y;

  ctx.fillStyle = "#d8dee6";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.fillRect(tl.x, tl.y, footprintW, footprintH);
  ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, footprintW - 1, footprintH - 1);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 0.5;
  const gridStep = Math.max(footprintW, footprintH) / 4;
  for (let i = 1; i < 4; i++) {
    const gx = tl.x + gridStep * i;
    const gy = tl.y + gridStep * i;
    ctx.beginPath();
    ctx.moveTo(gx, tl.y);
    ctx.lineTo(gx, tl.y + footprintH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tl.x, gy);
    ctx.lineTo(tl.x + footprintW, gy);
    ctx.stroke();
  }

  const player = worldToMap(state.playerX, state.playerZ, bounds, mapPx);
  const ahead = worldToMap(
    state.playerX + Math.sin(state.heading) * 0.5,
    state.playerZ + Math.cos(state.heading) * 0.5,
    bounds,
    mapPx,
  );
  const angle = Math.atan2(ahead.y - player.y, ahead.x - player.x);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#2563eb";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(player.x, player.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#0696d7";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

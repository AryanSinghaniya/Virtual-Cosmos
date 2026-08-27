import React, { useEffect, useRef } from 'react';
import { useCosmosStore } from '../../store/useCosmosStore';

interface MinimapProps {
  worldWidth?: number;
  worldHeight?: number;
}

export const Minimap: React.FC<MinimapProps> = ({
  worldWidth = 3200,
  worldHeight = 2400
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { users, myPosition, proximityConnections } = useCosmosStore();

  const mapW = 160;
  const mapH = 120;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, mapW, mapH);

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, mapW, mapH);

    // Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, mapW, mapH);

    const scaleX = mapW / worldWidth;
    const scaleY = mapH / worldHeight;

    // Draw other users
    Object.values(users).forEach((peer) => {
      const px = peer.x * scaleX;
      const py = peer.y * scaleY;
      const isNear = proximityConnections.some((c) => c.user_id === peer.user_id);

      ctx.fillStyle = isNear ? '#10b981' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw current player
    const mx = myPosition.x * scaleX;
    const my = myPosition.y * scaleY;

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pulse around player
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, 7, 0, Math.PI * 2);
    ctx.stroke();

  }, [users, myPosition, proximityConnections, worldWidth, worldHeight]);

  return (
    <div className="absolute top-20 right-6 z-20 backdrop-blur-md rounded-xl p-2 bg-slate-900/80 border border-slate-700/60 shadow-2xl">
      <div className="flex items-center justify-between pb-1.5 px-1 text-[11px] font-semibold text-slate-400">
        <span>Spatial Radar</span>
        <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
          LIVE
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={mapW}
        height={mapH}
        className="rounded-lg border border-slate-800"
      />
      <div className="flex justify-between items-center pt-1.5 px-1 text-[10px] text-slate-500 font-mono">
        <span>X: {Math.round(myPosition.x)}</span>
        <span>Y: {Math.round(myPosition.y)}</span>
      </div>
    </div>
  );
};

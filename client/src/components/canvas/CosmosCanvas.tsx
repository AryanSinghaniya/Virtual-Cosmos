import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useCosmosStore } from '../../store/useCosmosStore';

interface CosmosCanvasProps {
  worldWidth?: number;
  worldHeight?: number;
  onUserClick?: (userId: string, username: string, avatar: string) => void;
}

export const CosmosCanvas: React.FC<CosmosCanvasProps> = ({
  worldWidth = 3200,
  worldHeight = 2400,
  onUserClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { user } = useAuthStore();
  const { users, myPosition, proximityRadius, proximityConnections } = useCosmosStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const render = () => {
      const viewW = canvas.width;
      const viewH = canvas.height;

      // Camera offset centered on current user
      const camX = myPosition.x - viewW / 2;
      const camY = myPosition.y - viewH / 2;

      ctx.clearRect(0, 0, viewW, viewH);

      ctx.save();
      ctx.translate(-camX, -camY);

      // 1. Draw Cosmos Space World Background & Boundaries
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, worldWidth, worldHeight);

      // World border glowing aura
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, worldWidth, worldHeight);

      // 2. Subtle Starfield / Grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = 0; x < worldWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, worldHeight);
        ctx.stroke();
      }
      for (let y = 0; y < worldHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(worldWidth, y);
        ctx.stroke();
      }

      // 3. Proximity Aura around current user
      const pulse = (Math.sin(Date.now() / 400) + 1) * 0.5;
      const auraGradient = ctx.createRadialGradient(
        myPosition.x, myPosition.y, proximityRadius * 0.6,
        myPosition.x, myPosition.y, proximityRadius
      );
      auraGradient.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
      auraGradient.addColorStop(0.8, 'rgba(147, 51, 234, 0.08)');
      auraGradient.addColorStop(1, 'rgba(147, 51, 234, 0.0)');

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(myPosition.x, myPosition.y, proximityRadius, 0, Math.PI * 2);
      ctx.fill();

      // Aura boundary circle with subtle pulse
      ctx.strokeStyle = `rgba(147, 51, 234, ${0.3 + pulse * 0.25})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(myPosition.x, myPosition.y, proximityRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // 4. Draw Proximity Beams to connected nearby peers
      proximityConnections.forEach((conn) => {
        const peer = users[conn.user_id];
        if (peer) {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(myPosition.x, myPosition.y);
          ctx.lineTo(peer.x, peer.y);
          ctx.stroke();

          // Midpoint distance label
          const midX = (myPosition.x + peer.x) / 2;
          const midY = (myPosition.y + peer.y) / 2;
          const dist = Math.round(Math.hypot(myPosition.x - peer.x, myPosition.y - peer.y));

          ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
          ctx.fillRect(midX - 25, midY - 10, 50, 20);
          ctx.fillStyle = '#34d399';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${dist}px`, midX, midY + 4);
        }
      });

      // 5. Draw other users
      Object.values(users).forEach((peer) => {
        const isNear = proximityConnections.some((c) => c.user_id === peer.user_id);

        // Peer Shadow & Aura
        ctx.fillStyle = isNear ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(peer.x, peer.y, 28, 0, Math.PI * 2);
        ctx.fill();

        // Peer Avatar Bubble
        ctx.fillStyle = isNear ? '#065f46' : '#1f2937';
        ctx.strokeStyle = isNear ? '#10b981' : '#4b5563';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(peer.x, peer.y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Emoji
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(peer.avatar_emoji || '👤', peer.x, peer.y);

        // Name Tag
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(peer.display_name || peer.username, peer.x, peer.y - 32);

        // Proximity Badge
        if (isNear) {
          ctx.fillStyle = '#10b981';
          ctx.font = '10px sans-serif';
          ctx.fillText('⚡ Proximity Active', peer.x, peer.y + 36);
        }
      });

      // 6. Draw Current Player
      const myAvatar = user?.profile?.avatar_emoji || '🚀';
      const myName = user?.profile?.display_name || user?.username || 'You';

      // Player Base glow
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.beginPath();
      ctx.arc(myPosition.x, myPosition.y, 30, 0, Math.PI * 2);
      ctx.fill();

      // Player circle
      ctx.fillStyle = '#1e3a8a';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(myPosition.x, myPosition.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Player Emoji
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(myAvatar, myPosition.x, myPosition.y);

      // Player Label
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(`${myName} (You)`, myPosition.x, myPosition.y - 34);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [users, myPosition, proximityRadius, proximityConnections, user, worldWidth, worldHeight]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onUserClick) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const camX = myPosition.x - canvas.width / 2;
    const camY = myPosition.y - canvas.height / 2;

    const worldClickX = clickX + camX;
    const worldClickY = clickY + camY;

    Object.values(users).forEach((peer) => {
      const dist = Math.hypot(peer.x - worldClickX, peer.y - worldClickY);
      if (dist < 35) {
        onUserClick(peer.user_id, peer.display_name || peer.username, peer.avatar_emoji || '👤');
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      className="absolute inset-0 w-full h-full cursor-crosshair bg-slate-950"
    />
  );
};

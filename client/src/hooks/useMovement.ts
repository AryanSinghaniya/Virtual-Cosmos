import { useEffect, useRef } from 'react';
import { useCosmosStore } from '../store/useCosmosStore';

interface UseMovementProps {
  onMove: (x: number, y: number) => void;
  speed?: number;
  worldWidth?: number;
  worldHeight?: number;
}

export function useMovement({
  onMove,
  speed = 4.5,
  worldWidth = 3200,
  worldHeight = 2400
}: UseMovementProps) {
  const { myPosition, setMyPosition, setIsMoving } = useCosmosStore();
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const posRef = useRef(myPosition);
  const animFrameRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    posRef.current = myPosition;
  }, [myPosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        keysPressed.current[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keysPressed.current[key]) {
        keysPressed.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let isRunning = true;

    const gameLoop = (timestamp: number) => {
      if (!isRunning) return;

      let dx = 0;
      let dy = 0;

      const keys = keysPressed.current;
      if (keys['w'] || keys['arrowup']) dy -= speed;
      if (keys['s'] || keys['arrowdown']) dy += speed;
      if (keys['a'] || keys['arrowleft']) dx -= speed;
      if (keys['d'] || keys['arrowright']) dx += speed;

      if (dx !== 0 && dy !== 0) {
        // Normalize diagonal movement speed
        dx *= 0.7071;
        dy *= 0.7071;
      }

      if (dx !== 0 || dy !== 0) {
        setIsMoving(true);
        const newX = Math.max(30, Math.min(worldWidth - 30, posRef.current.x + dx));
        const newY = Math.max(30, Math.min(worldHeight - 30, posRef.current.y + dy));

        posRef.current = { x: newX, y: newY };
        setMyPosition(newX, newY);

        // Sync with backend at ~30-60 updates/sec
        if (timestamp - lastSyncTimeRef.current > 33) {
          onMove(newX, newY);
          lastSyncTimeRef.current = timestamp;
        }
      } else {
        setIsMoving(false);
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [speed, worldWidth, worldHeight, onMove, setMyPosition, setIsMoving]);
}

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ActiveConnection, ChatMessageItem, RoomZone, UserPresence } from './types/cosmos';
import { AIMatchmakerModal } from './components/ai/AIMatchmakerModal';
import { useMatchmakerStore } from './store/useMatchmakerStore';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';
const ALLOWED_AVATARS = ['🧑‍🚀', '👩‍🚀', '🛸', '🤖', '🐱', '🦊', '🐼', '🐸'];
const ALLOWED_STICKERS = ['😀', '😎', '🔥', '✨', '💯', '👋', '🎉', '🚀', '💫', '❤️'];
const CHANNELS = [
  { id: 'general-chat', name: '# general-chat' },
  { id: 'doubts-discussion', name: '# doubts-discussion' },
  { id: 'design-room', name: '# design-room' },
];

interface RemotePeerItem {
  userId: string;
  name: string;
  avatarEmoji: string;
  stream?: MediaStream;
}

// 1. Dedicated Remote Video Tile Component
const RemoteVideoTile: React.FC<{ peer: RemotePeerItem }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div className="video-tile">
      {peer.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
        />
      ) : (
        <div className="video-tile-avatar">
          <span>{peer.avatarEmoji || '👤'}</span>
        </div>
      )}
      <div className="video-tile-name">
        <span>{peer.name}</span>
        <span style={{ fontSize: '0.65rem', color: '#4ade80' }}>● Connected</span>
      </div>
    </div>
  );
};

// 2. Dedicated Local Video Tile Component (Guaranteed stream binding)
const LocalVideoTile: React.FC<{
  stream: MediaStream | null;
  name: string;
  avatarEmoji: string;
  isCamOn: boolean;
  isMicOn: boolean;
}> = ({ stream, name, avatarEmoji, isCamOn, isMicOn }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream && isCamOn) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isCamOn]);

  return (
    <div className="video-tile self-video">
      {isCamOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
        />
      ) : (
        <div className="video-tile-avatar">
          <span>{avatarEmoji || '🧑‍🚀'}</span>
        </div>
      )}
      <div className="video-tile-name">
        <span>{name || 'You'} (You)</span>
        <span style={{ fontSize: '0.65rem', color: isMicOn ? '#4ade80' : '#f87171' }}>
          {isMicOn ? '🎙️ Live' : '🔇 Muted'}
        </span>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  // Join state
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🧑‍🚀');
  const [joinError, setJoinError] = useState('');

  // Socket & World State
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [me, setMe] = useState<UserPresence | null>(null);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [activeConnectionRoomId, setActiveConnectionRoomId] = useState('');
  const [roomZones, setRoomZones] = useState<RoomZone[]>([
    { id: 'room-main', name: '🏛️ Main Stage & Keynote', x: 60, y: 60, w: 760, h: 560 },
    { id: 'room-1', name: '🎨 Design & AI Hub', x: 880, y: 60, w: 420, h: 260 },
    { id: 'room-2', name: '💻 Dev & Engineering', x: 1340, y: 60, w: 400, h: 260 },
    { id: 'room-3', name: '☕ Networking Lounge', x: 880, y: 340, w: 860, h: 280 },
    { id: 'room-plaza', name: '🌟 Community Plaza & Roundtable', x: 60, y: 640, w: 1680, h: 500 },
  ]);
  const [proximityRadius, setProximityRadius] = useState(240);
  const [worldDim, setWorldDim] = useState({ width: 1800, height: 1200 });

  // Navigation & Channels
  const [activeChannel, setActiveChannel] = useState('general-chat');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Map Zoom & Pan State
  const [mapZoom, setMapZoom] = useState(1.0);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Chat & Messaging
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [dockTab, setDockTab] = useState<'split' | 'chat' | 'call'>('split');
  const [isCallCollapsed, setIsCallCollapsed] = useState(false);

  // Multi-User Media & WebRTC Mesh Calling State
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isGroupCallActive, setIsGroupCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeerItem[]>([]);
  const [callError, setCallError] = useState('');

  // Floating Reactions Map on Canvas: { [userId]: { text: string; timestamp: number } }
  const [reactions, setReactions] = useState<{ [userId: string]: { text: string; timestamp: number } }>({});

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [userId: string]: RTCPeerConnection }>({});
  const iceCandidateQueueRef = useRef<{ [userId: string]: RTCIceCandidateInit[] }>({});
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const myPosRef = useRef({ x: 900, y: 600 });
  const animFrameRef = useRef<number | null>(null);
  const lastEmitTimeRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const { openMatchmaker } = useMatchmakerStore();

  const drainIceCandidates = async (userId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueueRef.current[userId] || [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('Queued ICE candidate failed', err);
      }
    }
    iceCandidateQueueRef.current[userId] = [];
  };

  // Scroll chat on new messages
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect to backend via Socket.IO
  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setJoinError('Please enter a pilot callsign/name.');
      return;
    }

    setJoinError('');
    setStatus('connecting');

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit(
        'user:register',
        {
          name: name.trim(),
          avatarEmoji: selectedAvatar,
          position: { x: myPosRef.current.x, y: myPosRef.current.y },
        },
        (res: any) => {
          if (res?.ok) {
            setJoined(true);
          }
        }
      );
    });

    socket.on('world:init', (data: any) => {
      setMe(data.you);
      if (data.you) {
        myPosRef.current = { x: data.you.x, y: data.you.y };
      }
      setUsers(data.users || []);
      if (data.world) {
        setWorldDim({ width: data.world.width, height: data.world.height });
      }
      if (data.radius) {
        setProximityRadius(data.radius);
      }
      if (data.roomZones) {
        setRoomZones(data.roomZones);
      }
    });

    socket.on('world:update', (data: any) => {
      setUsers(data.users || []);
    });

    socket.on('connections:update', (data: any) => {
      const conns: ActiveConnection[] = data.activeConnections || [];

      // Sort connections so active Room Zone (Main Stage, Lounge) comes first, followed by nearest peers
      conns.sort((a, b) => {
        if (a.linkType === 'room' && b.linkType !== 'room') return -1;
        if (b.linkType === 'room' && a.linkType !== 'room') return 1;
        return 0;
      });

      setConnections(conns);
      if (conns.length > 0) {
        setActiveConnectionRoomId((prev) => {
          const stillActive = conns.some((c) => c.roomId === prev);
          return stillActive ? prev : conns[0].roomId;
        });
      } else {
        setActiveConnectionRoomId('');
      }
    });

    socket.on('chat:message', (msg: ChatMessageItem) => {
      setMessages((prev) => [...prev, msg]);
      // Show floating reaction on canvas
      setReactions((prev) => ({
        ...prev,
        [msg.senderUserId]: { text: msg.text, timestamp: Date.now() },
      }));
    });

    // Multi-User WebRTC Mesh Signaling Events
    socket.on('rtc:user-joined', async (data: any) => {
      if (data.userId === socket.id) return;
      // When a remote peer joins our active call, establish connection
      initiateMeshPeerConnection(data.userId, data.name, data.avatarEmoji, data.roomId);
    });

    socket.on('rtc:offer', async (data: any) => {
      await handleReceiveMeshOffer(data);
    });

    socket.on('rtc:answer', async (data: any) => {
      const pc = peerConnectionsRef.current[data.fromUserId];
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await drainIceCandidates(data.fromUserId, pc);
      }
    });

    socket.on('rtc:ice-candidate', async (data: any) => {
      const pc = peerConnectionsRef.current[data.fromUserId];
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      } else {
        if (!iceCandidateQueueRef.current[data.fromUserId]) {
          iceCandidateQueueRef.current[data.fromUserId] = [];
        }
        iceCandidateQueueRef.current[data.fromUserId].push(data.candidate);
      }
    });

    socket.on('rtc:user-left', (data: any) => {
      cleanupMeshPeer(data.userId);
    });

    socket.on('rtc:hangup', (data: any) => {
      cleanupMeshPeer(data.fromUserId);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
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

  // 60fps Movement Game Loop
  useEffect(() => {
    if (!joined) return;

    let isRunning = true;
    const speed = 4.5;

    const gameLoop = (time: number) => {
      if (!isRunning) return;

      let dx = 0;
      let dy = 0;
      const keys = keysPressed.current;

      if (keys['w'] || keys['arrowup']) dy -= speed;
      if (keys['s'] || keys['arrowdown']) dy += speed;
      if (keys['a'] || keys['arrowleft']) dx -= speed;
      if (keys['d'] || keys['arrowright']) dx += speed;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      if (dx !== 0 || dy !== 0) {
        const nx = Math.max(20, Math.min(worldDim.width - 20, myPosRef.current.x + dx));
        const ny = Math.max(20, Math.min(worldDim.height - 20, myPosRef.current.y + dy));
        myPosRef.current = { x: nx, y: ny };

        if (time - lastEmitTimeRef.current > 33 && socketRef.current) {
          socketRef.current.emit('user:move', { x: nx, y: ny });
          lastEmitTimeRef.current = time;
        }
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [joined, worldDim]);

  // Canvas Mouse & Wheel Handlers
  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setMapZoom((z) => Math.max(0.4, Math.min(2.8, Math.round((z + delta) * 100) / 100)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingMap(true);
    dragStartRef.current = { x: e.clientX - mapPan.x, y: e.clientY - mapPan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingMap || !dragStartRef.current) return;
    setMapPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingMap(false);
    dragStartRef.current = null;
  };

  // Teleport helper
  const teleportToRoom = (zone: RoomZone) => {
    const targetX = zone.x + zone.w / 2;
    const targetY = zone.y + zone.h / 2;
    myPosRef.current = { x: targetX, y: targetY };
    socketRef.current?.emit('user:move', { x: targetX, y: targetY });
  };

  // 2D Cosmos Canvas Renderer with Cosmic Starfield, Nebulae, and Community Station Architecture
  useEffect(() => {
    if (!joined) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Deterministic cosmic starfield (160 stars)
    const stars: { x: number; y: number; s: number; b: number }[] = [];
    for (let i = 0; i < 160; i++) {
      stars.push({
        x: ((i * 137.5) % 1920),
        y: ((i * 269.3) % 1200),
        s: (i % 3) * 0.8 + 0.8,
        b: (i % 5) * 0.15 + 0.35,
      });
    }

    const render = () => {
      // Ensure canvas internal buffer matches crisp display dimensions
      if (canvas.clientWidth && canvas.clientHeight && (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight)) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // 1. Clear entire canvas with cosmic space background
      ctx.fillStyle = '#040711';
      ctx.fillRect(0, 0, cw, ch);

      // Cosmic Nebulae (Purple & Cyan clouds stretching across infinite space)
      const gradNebula1 = ctx.createRadialGradient(cw * 0.25, ch * 0.3, 40, cw * 0.25, ch * 0.3, cw * 0.55);
      gradNebula1.addColorStop(0, 'rgba(147, 51, 234, 0.16)');
      gradNebula1.addColorStop(0.6, 'rgba(79, 70, 229, 0.08)');
      gradNebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradNebula1;
      ctx.fillRect(0, 0, cw, ch);

      const gradNebula2 = ctx.createRadialGradient(cw * 0.8, ch * 0.75, 50, cw * 0.8, ch * 0.75, cw * 0.6);
      gradNebula2.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
      gradNebula2.addColorStop(0.5, 'rgba(14, 116, 144, 0.06)');
      gradNebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradNebula2;
      ctx.fillRect(0, 0, cw, ch);

      // Cosmic Twinkling Stars
      const now = Date.now() * 0.002;
      ctx.fillStyle = '#ffffff';
      stars.forEach((st, idx) => {
        const twinkle = Math.sin(now + idx) * 0.25 + st.b;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, twinkle));
        ctx.fillRect((st.x + mapPan.x * 0.2) % cw, (st.y + mapPan.y * 0.2) % ch, st.s, st.s);
      });
      ctx.globalAlpha = 1.0;

      // Base scaling factor so the entire community campus fits smoothly at 100% zoom
      const baseScale = Math.min(cw / worldDim.width, ch / worldDim.height);
      const scale = baseScale * mapZoom;
      const scaleX = scale;
      const scaleY = scale;

      const worldW = worldDim.width * scale;
      const worldH = worldDim.height * scale;

      // Center the community campus inside the canvas (independent of player position!)
      const originX = (cw - worldW) / 2 + mapPan.x;
      const originY = (ch - worldH) / 2 + mapPan.y;

      ctx.save();
      ctx.translate(originX, originY);

      // Station Solar Array Wings & Docking arms outside the perimeter
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 2;
      // Left solar wing
      ctx.strokeRect(-120 * scale, 120 * scale, 100 * scale, 340 * scale);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      ctx.fillRect(-120 * scale, 120 * scale, 100 * scale, 340 * scale);
      // Right solar wing
      ctx.strokeRect(worldW + 20 * scale, 120 * scale, 100 * scale, 340 * scale);
      ctx.fillRect(worldW + 20 * scale, 120 * scale, 100 * scale, 340 * scale);

      // 2. Station Hull / Campus Decking
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, worldW, worldH);

      // Outer Perimeter Railing & Neon Station Boundary
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(2, 3 * mapZoom);
      ctx.strokeRect(0, 0, worldW, worldH);

      // Glowing corner beacon docking pillars
      const corners = [
        { x: 0, y: 0 },
        { x: worldW, y: 0 },
        { x: 0, y: worldH },
        { x: worldW, y: worldH },
      ];
      corners.forEach((c) => {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6 * mapZoom, 0, Math.PI * 2);
        ctx.fill();
      });

      // Space Grid lines on campus floor
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.lineWidth = 1;
      const gridStep = 40 * scale;
      for (let x = 0; x < worldW; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, worldH);
        ctx.stroke();
      }
      for (let y = 0; y < worldH; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(worldW, y);
        ctx.stroke();
      }

      // 3. Render Community Meeting Rooms & Spaces
      roomZones.forEach((zone) => {
        const zx = zone.x * scaleX;
        const zy = zone.y * scaleY;
        const zw = zone.w * scaleX;
        const zh = zone.h * scaleY;

        // Room Background Floor
        ctx.fillStyle = zone.id === 'room-main'
          ? 'rgba(15, 23, 42, 0.94)'
          : zone.id === 'room-plaza'
          ? 'rgba(12, 20, 36, 0.9)'
          : 'rgba(17, 24, 39, 0.92)';
        ctx.fillRect(zx, zy, zw, zh);

        // Room Border Glow
        ctx.strokeStyle = zone.id === 'room-main'
          ? '#60a5fa'
          : zone.id === 'room-plaza'
          ? '#c084fc'
          : '#38bdf8';
        ctx.lineWidth = Math.max(1.5, 2 * mapZoom);
        ctx.strokeRect(zx, zy, zw, zh);

        // Room Header Badge
        ctx.fillStyle = zone.id === 'room-main' ? '#60a5fa' : zone.id === 'room-plaza' ? '#c084fc' : '#38bdf8';
        ctx.font = `bold ${Math.max(11, Math.round(13 * mapZoom))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(zone.name, zx + 12 * scale, zy + 22 * scale);

        // Draw internal architectural details for Community Meeting
        if (zone.id === 'room-main') {
          // Keynote Presentation Screen
          const scrW = zw * 0.75;
          const scrH = 42 * scale;
          const scrX = zx + (zw - scrW) / 2;
          const scrY = zy + 36 * scale;
          ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
          ctx.fillRect(scrX, scrY, scrW, scrH);
          ctx.strokeStyle = '#3b82f6';
          ctx.strokeRect(scrX, scrY, scrW, scrH);

          ctx.fillStyle = '#93c5fd';
          ctx.font = `bold ${Math.max(9, Math.round(11 * mapZoom))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('📊 VIRTUAL COSMOS COMMUNITY ALL-HANDS & KEYNOTE SCREEN', scrX + scrW / 2, scrY + scrH / 2 + 4);

          // Speaker Podium
          ctx.fillStyle = 'rgba(234, 179, 8, 0.2)';
          ctx.strokeStyle = '#facc15';
          ctx.strokeRect(zx + zw / 2 - 40 * scale, scrY + scrH + 10 * scale, 80 * scale, 24 * scale);
          ctx.fillStyle = '#fde047';
          ctx.font = `bold ${Math.max(8, Math.round(10 * mapZoom))}px sans-serif`;
          ctx.fillText('🎤 SPEAKER PODIUM', zx + zw / 2, scrY + scrH + 26 * scale);

          // Audience Seating Rows
          ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.font = `${Math.max(8, Math.round(11 * mapZoom))}px sans-serif`;
          for (let row = 0; row < 4; row++) {
            const rowY = scrY + scrH + (52 + row * 38) * scale;
            if (rowY < zy + zh - 15 * scale) {
              ctx.fillText('🪑  🪑  🪑  🪑  🪑  🪑  🪑  🪑  🪑  🪑  🪑  🪑', zx + zw / 2, rowY);
            }
          }
        } else if (zone.id === 'room-plaza') {
          // Central Town Hall Roundtables
          const tableCount = 4;
          const tableRadius = 38 * scale;
          const tableLabels = ['Alpha Roundtable', 'Beta Roundtable', 'Open Q&A Table', 'Project Pitch Table'];
          for (let i = 0; i < tableCount; i++) {
            const tx = zx + (zw / 5) * (i + 1);
            const ty = zy + zh / 2 + 10 * scale;

            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
            ctx.beginPath();
            ctx.arc(tx, ty, tableRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
            ctx.stroke();

            ctx.fillStyle = '#e9d5ff';
            ctx.font = `bold ${Math.max(8, Math.round(10 * mapZoom))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(tableLabels[i], tx, ty);
          }
        }
      });

      // 4. Current User Proximity Aura (Drawn centered on player position)
      const mx = myPosRef.current.x * scaleX;
      const my = myPosRef.current.y * scaleY;
      const r = proximityRadius * scaleX;

      const gradient = ctx.createRadialGradient(mx, my, r * 0.3, mx, my, r);
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(74, 222, 128, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Proximity Connection Beams
      users.forEach((u) => {
        if (u.socketId === socketRef.current?.id) return;
        const ux = u.x * scaleX;
        const uy = u.y * scaleY;
        const dist = Math.hypot(myPosRef.current.x - u.x, myPosRef.current.y - u.y);

        if (dist < proximityRadius) {
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
          ctx.lineWidth = Math.max(2, 2.5 * mapZoom);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(ux, uy);
          ctx.stroke();
        }
      });

      // 6. Draw Other Pilots
      users.forEach((u) => {
        if (u.socketId === socketRef.current?.id) return;
        const ux = u.x * scaleX;
        const uy = u.y * scaleY;
        const isNear = Math.hypot(myPosRef.current.x - u.x, myPosRef.current.y - u.y) < proximityRadius;
        const peerRadius = Math.max(10, 14 * mapZoom);

        ctx.fillStyle = isNear ? '#22c55e' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(ux, uy, peerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.max(12, Math.round(16 * mapZoom))}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.avatarEmoji || '👤', ux, uy);

        ctx.font = `bold ${Math.max(10, Math.round(11 * mapZoom))}px sans-serif`;
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(u.name, ux, uy - (peerRadius + 6));

        // Floating Reaction Bubble for peer
        const react = reactions[u.userId];
        if (react && Date.now() - react.timestamp < 4500) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          const bubbleY = uy - (peerRadius + 24);
          ctx.strokeRect(ux - 30, bubbleY - 14, 60, 20);
          ctx.fillRect(ux - 30, bubbleY - 14, 60, 20);

          ctx.fillStyle = '#fde047';
          ctx.font = '12px sans-serif';
          ctx.fillText(react.text.slice(0, 8), ux, bubbleY);
        }
      });

      // 7. Draw Current Player (Orange) - Moves smoothly across the static room map!
      const myRadius = Math.max(12, 16 * mapZoom);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(mx, my, myRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${Math.max(14, Math.round(18 * mapZoom))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedAvatar, mx, my);

      ctx.font = `bold ${Math.max(11, Math.round(12 * mapZoom))}px sans-serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`${name} (You)`, mx, my - (myRadius + 6));

      // Floating Reaction Bubble for self
      if (me && reactions[me.userId] && Date.now() - reactions[me.userId].timestamp < 4500) {
        const react = reactions[me.userId];
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        const bubbleY = my - (myRadius + 24);
        ctx.strokeRect(mx - 30, bubbleY - 14, 60, 20);
        ctx.fillRect(mx - 30, bubbleY - 14, 60, 20);

        ctx.fillStyle = '#86efac';
        ctx.font = '12px sans-serif';
        ctx.fillText(react.text.slice(0, 8), mx, bubbleY);
      }

      // Restore context
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [joined, users, proximityRadius, roomZones, selectedAvatar, name, worldDim, mapZoom, mapPan, reactions, me]);

  // Helper to generate a 30fps Live Virtual Animated HD Camera Stream
  const createVirtualLiveCameraStream = (avatar: string, pilotName: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      frame++;

      // Gradient space background
      const grad = ctx.createLinearGradient(0, 0, 480, 360);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 480, 360);

      // Glowing animated orbital circle
      const pulse = Math.sin(frame * 0.08) * 8;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(240, 150, 68 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Avatar emoji
      ctx.font = '76px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(avatar || '🧑‍🚀', 240, 150);

      // Live status badge
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('● LIVE VIRTUAL CAMERA', 240, 248);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(pilotName || 'Pilot', 240, 276);

      // Audio waveform animation
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 9; i++) {
        const h = Math.abs(Math.sin(frame * 0.15 + i * 0.5)) * 18 + 4;
        ctx.fillRect(240 - 45 + i * 10, 315 - h, 6, h);
      }
    };

    draw();
    const timer = setInterval(draw, 1000 / 30); // 30 FPS active stream

    const stream = canvas.captureStream(30);

    // Attach a silent audio track to guarantee full AV WebRTC negotiation
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {}

    const vTrack = stream.getVideoTracks()[0];
    if (vTrack) {
      const origStop = vTrack.stop.bind(vTrack);
      vTrack.stop = () => {
        clearInterval(timer);
        origStop();
      };
    }

    return stream;
  };

  // WebRTC Helper Functions for Multi-User Mesh Calling with Bulletproof Fallbacks
  const setupLocalMedia = async () => {
    if (!localStreamRef.current) {
      // 1. Attempt Full Physical Camera + Audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCamOn(true);
        setIsMicOn(true);
        setCallError('');
        return stream;
      } catch (videoErr: any) {
        console.warn('Physical camera locked or unavailable, activating Live 30fps Virtual Camera...', videoErr);
      }

      // 2. Fallback: Physical Audio + Live 30fps Virtual HD Video Camera
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const virtualStream = createVirtualLiveCameraStream(selectedAvatar, name);
        audioStream.getAudioTracks().forEach((t) => virtualStream.addTrack(t));

        localStreamRef.current = virtualStream;
        setLocalStream(virtualStream);
        setIsCamOn(true);
        setIsMicOn(true);
        setCallError('Physical camera busy: Connected via Live Virtual Camera');
        return virtualStream;
      } catch (audioErr: any) {
        console.warn('Audio also denied, activating full Live Virtual Camera stream...', audioErr);
      }

      // 3. Fallback: Complete Live 30fps Virtual HD Video & Silent Audio Stream
      const virtualFullStream = createVirtualLiveCameraStream(selectedAvatar, name);
      localStreamRef.current = virtualFullStream;
      setLocalStream(virtualFullStream);
      setIsCamOn(true);
      setIsMicOn(false);
      setCallError('Permissions blocked: Connected via Live Virtual Camera');
      return virtualFullStream;
    }
    return localStreamRef.current;
  };

  const cleanupMeshPeer = (targetUserId: string) => {
    if (peerConnectionsRef.current[targetUserId]) {
      try {
        peerConnectionsRef.current[targetUserId].close();
      } catch {}
      delete peerConnectionsRef.current[targetUserId];
    }
    setRemotePeers((prev) => prev.filter((p) => p.userId !== targetUserId));
  };

  const initiateMeshPeerConnection = async (
    targetUserId: string,
    targetName: string,
    targetAvatar: string,
    roomId: string
  ) => {
    try {
      const stream = await setupLocalMedia();
      let pc = peerConnectionsRef.current[targetUserId];
      
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        peerConnectionsRef.current[targetUserId] = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          const remoteStream = event.streams[0] || new MediaStream([event.track]);
          setRemotePeers((prev) => {
            const exists = prev.some((p) => p.userId === targetUserId);
            if (exists) {
              return prev.map((p) => (p.userId === targetUserId ? { ...p, stream: remoteStream } : p));
            }
            return [...prev, { userId: targetUserId, name: targetName, avatarEmoji: targetAvatar, stream: remoteStream }];
          });
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('rtc:ice-candidate', {
              roomId,
              targetUserId,
              candidate: event.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            cleanupMeshPeer(targetUserId);
          }
        };
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit('rtc:offer', {
        roomId,
        targetUserId,
        sdp: offer,
      });

      setRemotePeers((prev) => {
        if (!prev.some((p) => p.userId === targetUserId)) {
          return [...prev, { userId: targetUserId, name: targetName, avatarEmoji: targetAvatar }];
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Error initiating mesh connection with', targetUserId, err);
    }
  };

  const handleReceiveMeshOffer = async (data: any) => {
    try {
      const stream = await setupLocalMedia();
      const targetUserId = data.fromUserId;
      const targetName = data.fromName;
      const targetAvatar = data.fromAvatarEmoji;
      const roomId = data.roomId;

      let pc = peerConnectionsRef.current[targetUserId];

      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        peerConnectionsRef.current[targetUserId] = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          const remoteStream = event.streams[0] || new MediaStream([event.track]);
          setRemotePeers((prev) => {
            const exists = prev.some((p) => p.userId === targetUserId);
            if (exists) {
              return prev.map((p) => (p.userId === targetUserId ? { ...p, stream: remoteStream } : p));
            }
            return [...prev, { userId: targetUserId, name: targetName, avatarEmoji: targetAvatar, stream: remoteStream }];
          });
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('rtc:ice-candidate', {
              roomId,
              targetUserId,
              candidate: event.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            cleanupMeshPeer(targetUserId);
          }
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await drainIceCandidates(targetUserId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('rtc:answer', {
        roomId,
        targetUserId,
        sdp: answer,
      });

      setIsGroupCallActive(true);
      setRemotePeers((prev) => {
        if (!prev.some((p) => p.userId === targetUserId)) {
          return [...prev, { userId: targetUserId, name: targetName, avatarEmoji: targetAvatar }];
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Error handling mesh offer from', data.fromUserId, err);
    }
  };

  const startGroupCall = async (roomId: string) => {
    try {
      await setupLocalMedia();
      setIsGroupCallActive(true);
      setCallError('');

      socketRef.current?.emit('rtc:group-join', { roomId });

      // If there are existing active peers in the room, initiate connection
      const peersInRoom = connections.filter((c) => c.roomId === roomId);
      peersInRoom.forEach((p) => {
        initiateMeshPeerConnection(p.peerUserId, p.peerName, p.peerAvatarEmoji, roomId);
      });
    } catch (err: any) {
      setCallError('Could not start multi-user call: ' + err.message);
    }
  };

  const leaveGroupCall = (roomId: string) => {
    Object.keys(peerConnectionsRef.current).forEach((uid) => {
      cleanupMeshPeer(uid);
    });
    peerConnectionsRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    socketRef.current?.emit('rtc:group-leave', { roomId });
    setIsGroupCallActive(false);
    setRemotePeers([]);
    setIsCamOn(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !isMicOn));
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !isCamOn));
      setIsCamOn(!isCamOn);
    }
  };

  const toggleScreen = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsScreenSharing(true);
      } catch {
        // user cancelled
      }
    } else {
      setIsScreenSharing(false);
      await setupLocalMedia();
    }
  };

  // Chat message send
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeConnectionRoomId || !socketRef.current) return;

    socketRef.current.emit('chat:send', {
      roomId: activeConnectionRoomId,
      channel: activeChannel,
      type: 'text',
      text: messageInput.trim(),
    });
    setMessageInput('');
  };

  const handleSendSticker = (sticker: string) => {
    if (!activeConnectionRoomId || !socketRef.current) return;
    socketRef.current.emit('chat:send', {
      roomId: activeConnectionRoomId,
      channel: activeChannel,
      type: 'sticker',
      text: sticker,
    });
  };

  const filteredMembers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConnection = connections.find((c) => c.roomId === activeConnectionRoomId);

  return (
    <>
      {/* 1. Join Modal Overlay if not in Cosmos */}
      {!joined && (
        <div className="join-overlay">
          <form onSubmit={handleJoin} className="join-card">
            <h2>Join Virtual Cosmos</h2>
            <p>Select your pilot avatar and callsign to enter the 2D spatial realm.</p>

            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0' }}>
              {ALLOWED_AVATARS.map((av) => (
                <button
                  type="button"
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  style={{
                    fontSize: '1.4rem',
                    padding: '0.3rem',
                    borderRadius: '8px',
                    border: selectedAvatar === av ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: selectedAvatar === av ? '#dbeafe' : '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  {av}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              placeholder="Enter your pilot callsign..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {joinError && <div className="join-error">{joinError}</div>}

            <button type="submit" style={{ marginTop: '0.5rem' }}>
              Enter Cosmos
            </button>
          </form>
        </div>
      )}

      {/* 2. Main Gather-style Shell */}
      <div className="gather-shell">
        {/* Left Navigation Rail */}
        <aside className="left-rail">
          <div className="brand-block">
            <h1>VIRTUAL COSMOS</h1>
            <p>Live Spatial World</p>
          </div>

          <input
            type="text"
            className="search-box"
            placeholder="Search channels or pilots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="menu-group">
            <h2>CHANNELS</h2>
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`menu-item ${activeChannel === ch.id ? 'active' : ''}`}
              >
                {ch.name}
              </button>
            ))}
          </div>

          {/* AI Matchmaker Trigger */}
          <div className="menu-group" style={{ marginTop: '0.4rem' }}>
            <h2>AI DISCOVERY</h2>
            <button
              onClick={openMatchmaker}
              className="menu-item"
              style={{
                background: 'linear-gradient(135deg, #eef2ff, #f3e8ff)',
                borderColor: '#c084fc',
                fontWeight: 600,
                color: '#7e22ce',
              }}
            >
              🤖 AI Matchmaker (pgvector)
            </button>
          </div>

          <div className="member-list">
            <h2>ONLINE PILOTS ({users.length})</h2>
            {filteredMembers.map((member) => {
              const isMe = member.socketId === socketRef.current?.id;
              return (
                <div key={member.socketId} className="member-row">
                  <div className="avatar-chip">{member.avatarEmoji || '👤'}</div>
                  <div>
                    <h3>{member.name} {isMe ? '(You)' : ''}</h3>
                    <p>{member.roomName || 'Orbiting'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Stage */}
        <main className="center-stage">
          {/* Stage Top Bar */}
          <header className="stage-top">
            <div className="room-title">
              🌌 {me?.roomName ? `${me.roomName} (Zone)` : 'Virtual Cosmos Alpha Hub'} • #{activeChannel}
            </div>

            <div className="stage-actions">
              <button
                onClick={toggleMic}
                className={isMicOn ? 'active' : ''}
                title="Toggle Mic"
              >
                {isMicOn ? '🎙️ Mic On' : '🔇 Mic Off'}
              </button>

              <button
                onClick={toggleCam}
                className={isCamOn ? 'active' : ''}
                title="Toggle Camera"
              >
                {isCamOn ? '📹 Cam On' : '🚫 Cam Off'}
              </button>

              <button
                onClick={toggleScreen}
                className={isScreenSharing ? 'active' : ''}
                title="Share Screen"
              >
                🖥️ Share
              </button>

              <button
                onClick={() => {
                  socketRef.current?.disconnect();
                  setJoined(false);
                }}
                className="danger"
                title="Leave Cosmos"
              >
                Leave
              </button>

              <span className={`status-pill status-${status}`}>
                {status === 'connected' ? 'CONNECTED' : status === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'}
              </span>
            </div>
          </header>

          {/* Main Grid: 2D Canvas + Proximity Chat Dock */}
          <div className="main-grid">
            {/* 2D Spatial Canvas Stage with Zoom Controls & Teleport Bar */}
            <div className="map-stage">
              {/* Teleport Bar */}
              <div className="map-teleport-bar">
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginRight: '2px' }}>JUMP TO:</span>
                {roomZones.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => teleportToRoom(z)}
                    className="teleport-chip"
                    title={`Teleport to ${z.name}`}
                  >
                    {z.name.split(' ')[0]} {z.name.split(' ')[1]}
                  </button>
                ))}
              </div>

              {/* Zoom Controls HUD */}
              <div className="map-zoom-bar">
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100))}
                  title="Zoom Out"
                >
                  -
                </button>
                <span
                  onClick={() => { setMapZoom(1.0); setMapPan({ x: 0, y: 0 }); }}
                  style={{ cursor: 'pointer' }}
                  title="Click to Reset Zoom & Pan"
                >
                  {Math.round(mapZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.min(2.8, Math.round((z + 0.15) * 100) / 100))}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => { setMapZoom(0.85); setMapPan({ x: 0, y: 0 }); }}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.72rem' }}
                  title="Fit All Rooms & Hub"
                >
                  🔍 Fit
                </button>
              </div>

              <canvas
                ref={canvasRef}
                width={880}
                height={520}
                className="cosmos-canvas"
                onWheel={handleCanvasWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <div className="legend-row">
                <span><i className="dot me" /> You (WASD / Arrows)</span>
                <span><i className="dot peer" /> In Proximity (Green Beam)</span>
                <span><i className="dot crowd" /> Other Pilots</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.75rem' }}>
                  Scroll: Zoom | Drag: Pan | Pos: ({Math.round(myPosRef.current.x)}, {Math.round(myPosRef.current.y)})
                </span>
              </div>
            </div>

            {/* Proximity & Chat Dock */}
            <div className="chat-dock">
              {/* Flexible View Tabs */}
              <div className="dock-tab-strip">
                <button
                  onClick={() => setDockTab('split')}
                  className={`dock-tab-btn ${dockTab === 'split' ? 'active' : ''}`}
                >
                  🔀 Split View
                </button>
                <button
                  onClick={() => setDockTab('call')}
                  className={`dock-tab-btn ${dockTab === 'call' ? 'active' : ''}`}
                >
                  📹 Meeting Stage ({remotePeers.length + (isGroupCallActive ? 1 : 0)})
                </button>
                <button
                  onClick={() => setDockTab('chat')}
                  className={`dock-tab-btn ${dockTab === 'chat' ? 'active' : ''}`}
                >
                  💬 Proximity Chat
                </button>
              </div>

              {/* Connections List Strip */}
              {dockTab !== 'call' && (
                <div className="connections-list" style={{ marginTop: '0' }}>
                  {connections.map((conn) => (
                    <button
                      key={conn.roomId}
                      onClick={() => setActiveConnectionRoomId(conn.roomId)}
                      className={`conn ${activeConnectionRoomId === conn.roomId ? 'active' : ''}`}
                    >
                      <span>{conn.peerAvatarEmoji}</span>
                      <span>{conn.peerName} ({conn.roomName})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Multi-User WebRTC Video Call Shell */}
              {activeConnection && dockTab !== 'chat' && (
                <div className="call-shell" style={{ flex: dockTab === 'call' ? 1 : undefined }}>
                  <div className="call-head">
                    <div>
                      <h3>🏛️ {activeConnection.roomName} Call</h3>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                        {isGroupCallActive
                          ? `● ${remotePeers.length + 1} participant(s) in conference`
                          : `● ${connections.length + 1} pilot(s) in room zone`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {isGroupCallActive && (
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                          LIVE MESH
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsCallCollapsed(!isCallCollapsed)}
                        style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                        title={isCallCollapsed ? 'Expand Call' : 'Collapse Call'}
                      >
                        {isCallCollapsed ? '➕ Expand' : '➖ Collapse'}
                      </button>
                    </div>
                  </div>

                  {!isCallCollapsed && (
                    <>
                      {/* Multi-User Video Grid with reliable LocalVideoTile */}
                      <div className="video-grid" style={{ maxHeight: dockTab === 'call' ? '460px' : '180px' }}>
                        {/* Local Video Tile */}
                        <LocalVideoTile
                          stream={localStream}
                          name={name || 'You'}
                          avatarEmoji={selectedAvatar}
                          isCamOn={isCamOn}
                          isMicOn={isMicOn}
                        />

                        {/* Remote Attendees Video Tiles */}
                        {remotePeers.map((peer) => (
                          <RemoteVideoTile key={peer.userId} peer={peer} />
                        ))}
                      </div>

                      {/* Call Action Controls */}
                      <div className="call-actions">
                        {!isGroupCallActive ? (
                          <button
                            onClick={() => startGroupCall(activeConnection.roomId)}
                            className="call-btn primary"
                            style={{ width: '100%', padding: '0.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff' }}
                          >
                            🚀 Join Group Call ({connections.length + 1} in {activeConnection.roomName})
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={toggleMic}
                              className={`call-btn ${isMicOn ? 'active' : ''}`}
                            >
                              {isMicOn ? '🎙️ Mic On' : '🔇 Mic Off'}
                            </button>

                            <button
                              onClick={toggleCam}
                              className={`call-btn ${isCamOn ? 'active' : ''}`}
                            >
                              {isCamOn ? '📹 Cam On' : '🚫 Cam Off'}
                            </button>

                            <button
                              onClick={toggleScreen}
                              className={`call-btn ${isScreenSharing ? 'active' : ''}`}
                            >
                              {isScreenSharing ? '🖥️ Stop Share' : '🖥️ Share Screen'}
                            </button>

                            <button
                              onClick={() => leaveGroupCall(activeConnection.roomId)}
                              className="call-btn danger"
                              style={{ marginLeft: 'auto' }}
                            >
                              🔴 Leave Call
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {callError && <div className="call-error">{callError}</div>}
                </div>
              )}

              {/* Chat Feed */}
              {dockTab !== 'call' && (
                <>
                  <div className="messages" style={{ flex: 1 }}>
                    {messages
                      .filter((m) => !activeConnectionRoomId || m.roomId === activeConnectionRoomId)
                      .map((msg, idx) => {
                        const isOwn = msg.senderUserId === me?.userId;
                        return (
                          <div key={idx} className={`message ${isOwn ? 'own' : ''}`}>
                            <h3>
                              <span className="msg-avatar">{msg.senderAvatarEmoji}</span>
                              <span>{msg.senderName} {isOwn ? '(You)' : ''}</span>
                            </h3>
                            {msg.type === 'sticker' ? (
                              <div className="sticker-content">{msg.text}</div>
                            ) : (
                              <p>{msg.text}</p>
                            )}
                          </div>
                        );
                      })}
                    <div ref={chatScrollRef} />
                  </div>

                  {/* Chat Composer */}
                  {activeConnection ? (
                    <>
                      <form onSubmit={handleSendMessage} className="composer">
                        <input
                          type="text"
                          placeholder={`Message in ${activeConnection.roomName}...`}
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                        />
                        <button type="submit">Send</button>
                      </form>

                      <div className="sticker-row">
                        {ALLOWED_STICKERS.map((stk) => (
                          <button
                            key={stk}
                            type="button"
                            onClick={() => handleSendSticker(stk)}
                            className="sticker-btn"
                          >
                            {stk}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="chat-disabled">
                      🔒 Proximity Chat Locked. Walk near another pilot to enable chat and calling!
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* AI Vector Matchmaker Modal */}
      <AIMatchmakerModal />
    </>
  );
};

export default App;

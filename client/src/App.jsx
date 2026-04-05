import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { io } from 'socket.io-client';
import './App.css';

const DEPLOY_FALLBACK_SERVER_URL = 'https://virtual-cosmos-zni1.onrender.com';
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')
    ? DEPLOY_FALLBACK_SERVER_URL
    : 'http://localhost:4000');
const PLAYER_SPEED = 240;
const AVATAR_OPTIONS = ['🧑‍🚀', '👩‍🚀', '🛸', '🤖', '🐱', '🦊', '🐼', '🐸'];
const STICKER_OPTIONS = ['😀', '😎', '🔥', '✨', '💯', '👋', '🎉', '🚀', '💫', '❤️'];
const NAV_ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const NAV_CHANNELS = ['general-chat', 'doubts-discussion', 'design-room'];
const DEFAULT_NAV_ROOM = NAV_ROOMS[2] || NAV_ROOMS[0] || 'Space';
const DEFAULT_CHANNEL = NAV_CHANNELS[0] || 'general-chat';
const AVATAR_CARD_THEMES = [
  { background: '#f5cb42', border: '#fef3c7' },
  { background: '#f43f87', border: '#fce7f3' },
  { background: '#ef4444', border: '#fee2e2' },
  { background: '#22c55e', border: '#dcfce7' },
  { background: '#3b82f6', border: '#dbeafe' },
];
const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
const UI_SYNC_INTERVAL_MS = 45;
const MOVE_EMIT_INTERVAL_MS = 28;
const MOVE_EMIT_MIN_DISTANCE = 1.2;
const REMOTE_SMOOTH_BLEND = 0.38;
const PIXI_MAX_RESOLUTION = 1.25;
const SELF_CORRECTION_DISTANCE = 140;
const SELF_HARD_SNAP_DISTANCE = 320;
const SELF_SERVER_BLEND = 0.2;
const ROOM_CENTERS = {
  'Room 1': { x: 295, y: 240 },
  'Room 2': { x: 740, y: 240 },
  'Room 3': { x: 1195, y: 240 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function hashIndex(value, max) {
  let hash = 0;
  const text = String(value || 'user');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

function avatarImageUrl(seed) {
  const safeSeed = encodeURIComponent(seed || 'pilot');
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${safeSeed}&radius=16`;
}

function avatarCardTheme(seed) {
  return AVATAR_CARD_THEMES[hashIndex(seed, AVATAR_CARD_THEMES.length)];
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function stopTracks(stream) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

async function requestMediaWithFallbacks() {
  const attempts = [
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
      },
    },
    {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    },
    {
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
      },
    },
  ];

  let lastError;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to access camera or microphone.');
}

function App() {
  const canvasContainerRef = useRef(null);
  const avatarPopupRef = useRef(null);
  const appRef = useRef(null);
  const socketRef = useRef(null);
  const userIdRef = useRef('');
  const playerPosRef = useRef({ x: 200, y: 200 });
  const pressedKeysRef = useRef(new Set());
  const lastMoveEmitRef = useRef(0);
  const lastMoveEmitPosRef = useRef({ x: 200, y: 200 });
  const lastUiSyncRef = useRef(0);
  const activeRoomRef = useRef('');
  const activePeerRef = useRef('');
  const callStateRef = useRef('idle');
  const incomingCallRef = useRef(null);
  const micEnabledRef = useRef(true);
  const camEnabledRef = useRef(true);
  const peerConnectionRef = useRef(null);
  const currentCallRef = useRef({ roomId: '', peerUserId: '' });
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const targetUsersRef = useRef([]);
  const smoothedUsersRef = useRef(new Map());
  const connectionsRef = useRef([]);
  const worldRef = useRef({ width: 1800, height: 1200 });
  const radiusRef = useRef(180);
  const timerWasRunningRef = useRef(false);
  const avatarPopupDragRef = useRef({
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });

  const [status, setStatus] = useState('connecting');
  const [world, setWorld] = useState({ width: 1800, height: 1200 });
  const [radius, setRadius] = useState(180);
  const [users, setUsers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [activePeerUserId, setActivePeerUserId] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [callError, setCallError] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [nameDraft, setNameDraft] = useState(
    () => localStorage.getItem('cosmos-name') || '',
  );
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [navQuery, setNavQuery] = useState('');
  const [selectedNavRoom, setSelectedNavRoom] = useState(DEFAULT_NAV_ROOM);
  const [selectedChannel, setSelectedChannel] = useState(DEFAULT_CHANNEL);
  const [dockNotice, setDockNotice] = useState('');
  const [isUiLocked, setIsUiLocked] = useState(false);
  const [isMovementEnabled, setIsMovementEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isDraggingAvatarPopup, setIsDraggingAvatarPopup] = useState(false);
  const [isAvatarPopupMinimized, setIsAvatarPopupMinimized] = useState(false);
  const [avatarPopupZoom, setAvatarPopupZoom] = useState(1);
  const [avatarPopupPos, setAvatarPopupPos] = useState(() => ({
    x: typeof window === 'undefined' ? 12 : Math.max(12, window.innerWidth - 560),
    y: 84,
  }));
  const [mediaCapabilities, setMediaCapabilities] = useState({
    audio: false,
    video: false,
  });

  function showDockNotice(text) {
    setDockNotice(text);
  }

  function clampAvatarPopupZoom(value) {
    return clamp(value, 0.75, 1.35);
  }

  function clampAvatarPopupToViewport(nextX, nextY) {
    const margin = 10;
    const popupRect = avatarPopupRef.current?.getBoundingClientRect();
    const popupWidth = popupRect?.width || 520;
    const popupHeight = popupRect?.height || 208;
    const maxX = Math.max(margin, window.innerWidth - popupWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - popupHeight - margin);

    return {
      x: clamp(nextX, margin, maxX),
      y: clamp(nextY, margin, maxY),
    };
  }

  function handleAvatarPopupPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const popupRect = avatarPopupRef.current?.getBoundingClientRect();
    avatarPopupDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (popupRect?.left || 0),
      offsetY: event.clientY - (popupRect?.top || 0),
    };

    setIsDraggingAvatarPopup(true);
    event.preventDefault();
  }

  function handleAvatarPopupZoomOut() {
    setAvatarPopupZoom((current) => clampAvatarPopupZoom(current - 0.1));
  }

  function handleAvatarPopupZoomIn() {
    setAvatarPopupZoom((current) => clampAvatarPopupZoom(current + 0.1));
  }

  function handleAvatarPopupMinimizeToggle() {
    setIsAvatarPopupMinimized((current) => !current);
  }

  const playerAvatar = useMemo(() => {
    const existing = localStorage.getItem('cosmos-avatar');
    if (existing && AVATAR_OPTIONS.includes(existing)) {
      return existing;
    }

    const generated = randomFrom(AVATAR_OPTIONS);
    localStorage.setItem('cosmos-avatar', generated);
    return generated;
  }, []);

  const activeMessages = useMemo(() => {
    const roomMessages = messagesByRoom[activeRoomId] || [];
    return roomMessages.filter(
      (message) => (message.channel || DEFAULT_CHANNEL) === selectedChannel,
    );
  }, [activeRoomId, messagesByRoom, selectedChannel]);

  const filteredRooms = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) {
      return NAV_ROOMS;
    }

    return NAV_ROOMS.filter((room) => room.toLowerCase().includes(query));
  }, [navQuery]);

  const filteredChannels = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) {
      return NAV_CHANNELS;
    }

    return NAV_CHANNELS.filter((channel) => channel.toLowerCase().includes(query));
  }, [navQuery]);

  const activeConnection =
    connections.find(
      (connection) =>
        connection.roomId === activeRoomId &&
        connection.peerUserId === activePeerUserId,
    ) || connections.find((connection) => connection.roomId === activeRoomId);

  const connectedAvatarUsers = useMemo(() => {
    if (connections.length === 0) {
      return [];
    }

    const peerIds = new Set(connections.map((connection) => connection.peerUserId));
    const peers = users.filter((user) => peerIds.has(user.userId));
    const selfUser = users.find((user) => user.userId === userIdRef.current);

    return (selfUser ? [selfUser, ...peers] : peers).slice(0, 8);
  }, [connections, users]);

  function handleJoinSubmit(event) {
    event.preventDefault();
    const cleaned = String(nameDraft || '').trim().slice(0, 24);
    if (!cleaned) {
      setNameError('Please enter your name to join the cosmos.');
      return;
    }

    localStorage.setItem('cosmos-name', cleaned);
    setPlayerName(cleaned);
    setHasEnteredName(true);
    setNameError('');
  }

  function callStatusLabel(state) {
    if (state === 'ringing-outgoing') {
      return 'Ringing...';
    }
    if (state === 'ringing-incoming') {
      return 'Incoming call';
    }
    if (state === 'connected') {
      return 'Live';
    }
    if (state === 'connecting') {
      return 'Connecting...';
    }
    if (state === 'requesting-media') {
      return 'Waiting for media permission...';
    }
    if (state === 'error') {
      return 'Call unavailable';
    }
    return 'Idle';
  }

  function teardownPeerConnection() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    currentCallRef.current = { roomId: '', peerUserId: '' };
    setRemoteStream(null);
  }

  function stopScreenShare() {
    const connection = peerConnectionRef.current;
    const sender = connection
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === 'video');
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

    if (sender && cameraTrack) {
      sender.replaceTrack(cameraTrack).catch(() => {
        // Ignore replace errors when peer closes mid-transition.
      });
    }

    stopTracks(screenStreamRef.current);
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }

  function stopLocalMedia() {
    stopTracks(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setMediaCapabilities({ audio: false, video: false });
  }

  async function attachCameraTrack() {
    if (!localStreamRef.current) {
      return false;
    }

    let cameraStream;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user',
        },
      });
    } catch {
      return false;
    }

    const [newVideoTrack] = cameraStream.getVideoTracks();
    if (!newVideoTrack) {
      stopTracks(cameraStream);
      return false;
    }

    const localStream = localStreamRef.current;
    const existingVideo = localStream.getVideoTracks()[0];

    if (existingVideo) {
      localStream.removeTrack(existingVideo);
      existingVideo.stop();
    }

    localStream.addTrack(newVideoTrack);

    const connection = peerConnectionRef.current;
    if (connection) {
      const videoSender = connection
        .getSenders()
        .find((sender) => sender.track?.kind === 'video');

      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      } else {
        connection.addTrack(newVideoTrack, localStream);
      }
    }

    setLocalStream(new MediaStream(localStream.getTracks()));
    setMediaCapabilities((prev) => ({ ...prev, video: true }));
    setCallError('');
    return true;
  }

  function endCurrentCall(emitHangup) {
    const socket = socketRef.current;
    const currentCall = currentCallRef.current;

    if (emitHangup && socket && currentCall.roomId && currentCall.peerUserId) {
      socket.emit('rtc:hangup', {
        roomId: currentCall.roomId,
        targetUserId: currentCall.peerUserId,
      });
    }

    stopScreenShare();
    teardownPeerConnection();
    stopLocalMedia();
    setIncomingCall(null);
    callStateRef.current = 'idle';
    setCallState('idle');
    setCallError('');
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    callStateRef.current = 'requesting-media';
    setCallState('requesting-media');

    const stream = await requestMediaWithFallbacks();
    const hasAudio = stream.getAudioTracks().length > 0;
    const hasVideo = stream.getVideoTracks().length > 0;
    setMediaCapabilities({ audio: hasAudio, video: hasVideo });

    if (!hasAudio || !hasVideo) {
      setCallError(
        hasAudio
          ? 'Camera unavailable, continuing with audio only.'
          : hasVideo
            ? 'Microphone unavailable, continuing with video only.'
            : 'No camera/microphone access available.',
      );
    }

    for (const track of stream.getAudioTracks()) {
      track.enabled = micEnabledRef.current;
    }
    for (const track of stream.getVideoTracks()) {
      track.enabled = camEnabledRef.current;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  function ensurePeerConnection(roomId, peerUserId) {
    const existing = peerConnectionRef.current;
    const currentCall = currentCallRef.current;
    if (
      existing &&
      currentCall.roomId === roomId &&
      currentCall.peerUserId === peerUserId
    ) {
      return existing;
    }

    teardownPeerConnection();

    const socket = socketRef.current;
    const stream = localStreamRef.current;
    if (!socket || !stream) {
      throw new Error('Cannot start call without socket and media stream.');
    }

    const connection = new RTCPeerConnection(RTC_CONFIG);
    for (const track of stream.getTracks()) {
      connection.addTrack(track, stream);
    }

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      socket.emit('rtc:ice-candidate', {
        roomId,
        targetUserId: peerUserId,
        candidate: event.candidate,
      });
    };

    connection.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        setRemoteStream(incomingStream);
      }
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        callStateRef.current = 'connected';
        setCallState('connected');
        setCallError('');
      }

      if (
        connection.connectionState === 'failed' ||
        connection.connectionState === 'disconnected' ||
        connection.connectionState === 'closed'
      ) {
        endCurrentCall(false);
      }
    };

    peerConnectionRef.current = connection;
    currentCallRef.current = { roomId, peerUserId };
    callStateRef.current = 'connecting';
    setCallState('connecting');
    return connection;
  }

  async function createAndSendOffer(roomId, peerUserId) {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    try {
      await ensureLocalStream();
      const connection = ensurePeerConnection(roomId, peerUserId);

      if (connection.signalingState !== 'stable') {
        return;
      }

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      socket.emit('rtc:offer', {
        roomId,
        targetUserId: peerUserId,
        sdp: offer,
      });

      callStateRef.current = 'connecting';
      setCallState('connecting');
      setCallError('');
    } catch {
      callStateRef.current = 'error';
      setCallState('error');
      setCallError('Allow microphone and camera access to start call.');
    }
  }

  async function startOutgoingCall() {
    const socket = socketRef.current;
    if (!socket || !activeConnection) {
      return;
    }

    if (currentCallRef.current.roomId) {
      endCurrentCall(true);
    }

    setIncomingCall(null);
    setCallError('');

    try {
      await ensureLocalStream();
    } catch {
      callStateRef.current = 'error';
      setCallState('error');
      setCallError('Enable camera/microphone permission and try again.');
      return;
    }

    callStateRef.current = 'ringing-outgoing';
    setCallState('ringing-outgoing');

    socket.emit('rtc:call-request', {
      roomId: activeConnection.roomId,
      targetUserId: activeConnection.peerUserId,
    });
  }

  async function acceptIncomingCall() {
    const socket = socketRef.current;
    const pending = incomingCall;
    if (!socket || !pending) {
      return;
    }

    try {
      await ensureLocalStream();
    } catch {
      callStateRef.current = 'error';
      setCallState('error');
      setCallError('Enable camera/microphone permission to accept call.');
      return;
    }

    setCallError('');
    callStateRef.current = 'connecting';
    setCallState('connecting');

    socket.emit('rtc:call-accept', {
      roomId: pending.roomId,
      targetUserId: pending.fromUserId,
    });

    setIncomingCall(null);
  }

  function rejectIncomingCall() {
    const socket = socketRef.current;
    const pending = incomingCall;
    if (!socket || !pending) {
      return;
    }

    socket.emit('rtc:call-reject', {
      roomId: pending.roomId,
      targetUserId: pending.fromUserId,
    });

    setIncomingCall(null);
    callStateRef.current = 'idle';
    setCallState('idle');
  }

  function cancelOutgoingRing() {
    const socket = socketRef.current;
    if (!socket || !activeConnection) {
      return;
    }

    socket.emit('rtc:call-reject', {
      roomId: activeConnection.roomId,
      targetUserId: activeConnection.peerUserId,
    });

    callStateRef.current = 'idle';
    setCallState('idle');
  }

  async function startScreenShare() {
    if (isScreenSharing || !peerConnectionRef.current || !localStreamRef.current) {
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        stopTracks(displayStream);
        return;
      }

      const videoSender = peerConnectionRef.current
        .getSenders()
        .find((sender) => sender.track?.kind === 'video');

      if (!videoSender) {
        stopTracks(displayStream);
        return;
      }

      await videoSender.replaceTrack(screenTrack);
      screenTrack.onended = () => {
        stopScreenShare();
      };

      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);
      setCallError('');
    } catch {
      setCallError('Screen sharing permission denied.');
    }
  }

  async function toggleCamera() {
    if (isCamEnabled && localStreamRef.current && localStreamRef.current.getVideoTracks().length === 0) {
      const attached = await attachCameraTrack();
      if (!attached) {
        setCallError('Camera access failed. Check browser camera permission and that no other app is using it.');
        setMediaCapabilities((prev) => ({ ...prev, video: false }));
        return;
      }

      setIsCamEnabled(true);
      return;
    }

    const willEnable = !isCamEnabled;

    if (willEnable && localStreamRef.current && localStreamRef.current.getVideoTracks().length === 0) {
      const attached = await attachCameraTrack();
      if (!attached) {
        setCallError('Camera access failed. Check browser camera permission and that no other app is using it.');
        setMediaCapabilities((prev) => ({ ...prev, video: false }));
        return;
      }
    }

    setIsCamEnabled(willEnable);
  }

  useEffect(() => {
    let isDisposed = false;

    async function initializePixi() {
      const container = canvasContainerRef.current;
      if (!container) {
        return;
      }

      const app = new Application();
      await app.init({
        resizeTo: container,
        antialias: true,
        background: '#060915',
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, PIXI_MAX_RESOLUTION),
      });

      if (isDisposed) {
        app.destroy();
        return;
      }

      appRef.current = app;
      container.appendChild(app.canvas);
    }

    initializePixi();

    return () => {
      isDisposed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    activePeerRef.current = activePeerUserId;
  }, [activePeerUserId]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  useEffect(() => {
    targetUsersRef.current = users;

    const ids = new Set(users.map((user) => user.userId));
    for (const user of users) {
      if (!smoothedUsersRef.current.has(user.userId)) {
        smoothedUsersRef.current.set(user.userId, { x: user.x, y: user.y });
      }
    }

    for (const knownUserId of [...smoothedUsersRef.current.keys()]) {
      if (!ids.has(knownUserId)) {
        smoothedUsersRef.current.delete(knownUserId);
      }
    }
  }, [users]);

  useEffect(() => {
    if (!dockNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDockNotice('');
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dockNotice]);

  useEffect(() => {
    if (timerSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setTimerSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [timerSeconds]);

  useEffect(() => {
    if (timerSeconds > 0) {
      timerWasRunningRef.current = true;
      return;
    }

    if (timerWasRunningRef.current) {
      timerWasRunningRef.current = false;
      showDockNotice('Timer finished.');
    }
  }, [timerSeconds]);

  useEffect(() => {
    if (!isMovementEnabled || isUiLocked) {
      pressedKeysRef.current.clear();
    }
  }, [isMovementEnabled, isUiLocked]);

  useEffect(() => {
    if (!isDraggingAvatarPopup) {
      return undefined;
    }

    const onPointerMove = (event) => {
      const dragState = avatarPopupDragRef.current;
      if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) {
        return;
      }

      const nextPosition = clampAvatarPopupToViewport(
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY,
      );
      setAvatarPopupPos(nextPosition);
    };

    const stopDrag = (event) => {
      const dragState = avatarPopupDragRef.current;
      if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) {
        return;
      }

      avatarPopupDragRef.current.pointerId = null;
      setIsDraggingAvatarPopup(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [isDraggingAvatarPopup]);

  useEffect(() => {
    const onResize = () => {
      setAvatarPopupPos((current) => clampAvatarPopupToViewport(current.x, current.y));
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (connectedAvatarUsers.length === 0) {
      return undefined;
    }

    const rafId = window.requestAnimationFrame(() => {
      setAvatarPopupPos((current) => clampAvatarPopupToViewport(current.x, current.y));
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [avatarPopupZoom, connectedAvatarUsers.length, isAvatarPopupMinimized]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    micEnabledRef.current = isMicEnabled;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = isMicEnabled;
      }
    }
  }, [isMicEnabled]);

  useEffect(() => {
    camEnabledRef.current = isCamEnabled;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getVideoTracks()) {
        track.enabled = isCamEnabled;
      }
    }
  }, [isCamEnabled]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      if (localStream) {
        localVideoRef.current.play().catch(() => {
          // Autoplay can fail in some browser states.
        });
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      if (remoteStream) {
        remoteVideoRef.current.play().catch(() => {
          // Autoplay can fail in some browser states.
        });
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    const selectedConnection =
      connections.find(
        (item) =>
          item.roomId === activeRoomId &&
          item.peerUserId === activePeerUserId,
      ) || connections.find((item) => item.roomId === activeRoomId);

    if (!selectedConnection) {
      if (currentCallRef.current.roomId) {
        endCurrentCall(false);
      }
      if (callState === 'ringing-outgoing' || callState === 'ringing-incoming') {
        callStateRef.current = 'idle';
        setCallState('idle');
      }
      if (incomingCall && incomingCall.roomId === activeRoomId) {
        setIncomingCall(null);
      }
      return;
    }

    if (
      currentCallRef.current.roomId &&
      (
        currentCallRef.current.roomId !== selectedConnection.roomId ||
        currentCallRef.current.peerUserId !== selectedConnection.peerUserId
      )
    ) {
      endCurrentCall(true);
    }
  }, [activePeerUserId, activeRoomId, callState, connections, incomingCall]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    let rafId = 0;

    const roomBlocks = [
      { x: 100, y: 110, w: 390, h: 260, color: 0xaf9a7f, title: 'Room 1' },
      { x: 540, y: 110, w: 400, h: 260, color: 0xb19c85, title: 'Room 2' },
      { x: 980, y: 110, w: 430, h: 260, color: 0xa18f79, title: 'Room 3' },
    ];
    const tones = [0xec4899, 0xf59e0b, 0x3b82f6, 0x10b981, 0x8b5cf6, 0xef4444];
    const staticLayer = new Container();
    const dynamicLayer = new Container();
    app.stage.removeChildren();
    app.stage.addChild(staticLayer);
    app.stage.addChild(dynamicLayer);

    let staticSceneKey = '';

    const drawStaticScene = (liveWorld, scale, offsetX, offsetY) => {
      staticLayer.removeChildren();

      const toScreen = (x, y) => ({
        x: offsetX + x * scale,
        y: offsetY + y * scale,
      });

      const worldLayer = new Graphics();
      const grassHeight = 82;
      worldLayer
        .rect(offsetX, offsetY, liveWorld.width * scale, liveWorld.height * scale)
        .fill(0xd8c09a)
        .stroke({ width: 2, color: 0x7e5f3d, alpha: 0.65 })
        .rect(offsetX + 2, offsetY + 2, liveWorld.width * scale - 4, grassHeight * scale)
        .fill(0x6ea95a)
        .stroke({ width: 1, color: 0x356d2a, alpha: 0.55 });

      const gridColor = 0x7a5838;
      const gridGap = 120;
      for (let gx = 0; gx <= liveWorld.width; gx += gridGap) {
        const start = toScreen(gx, 0);
        const end = toScreen(gx, liveWorld.height);
        worldLayer.moveTo(start.x, start.y).lineTo(end.x, end.y);
      }
      for (let gy = 0; gy <= liveWorld.height; gy += gridGap) {
        const start = toScreen(0, gy);
        const end = toScreen(liveWorld.width, gy);
        worldLayer.moveTo(start.x, start.y).lineTo(end.x, end.y);
      }
      worldLayer.stroke({ width: 1, color: gridColor, alpha: 0.1 });

      const roomLabelStyle = new TextStyle({
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: Math.max(9, 16 * scale),
        fill: '#f8fafc',
        fontWeight: '700',
      });

      staticLayer.addChild(worldLayer);

      for (const block of roomBlocks) {
        const topLeft = toScreen(block.x, block.y);
        const sizeX = block.w * scale;
        const sizeY = block.h * scale;
        const tile = new Graphics();
        tile
          .rect(topLeft.x, topLeft.y, sizeX, sizeY)
          .fill(block.color)
          .stroke({ color: 0x433124, width: 1, alpha: 0.5 });
        staticLayer.addChild(tile);

        const roomLabel = new Text({ text: block.title, style: roomLabelStyle });
        roomLabel.anchor.set(0, 0);
        roomLabel.position.set(topLeft.x + 8, topLeft.y + 6);
        staticLayer.addChild(roomLabel);
      }
    };

    const drawFrame = () => {
      const liveWorld = worldRef.current;
      const liveRadius = radiusRef.current;
      const liveUsers = targetUsersRef.current;
      const connectedPeerIds = new Set(
        connectionsRef.current.map((connection) => connection.peerUserId),
      );

      const viewWidth = app.renderer.width;
      const viewHeight = app.renderer.height;
      const scale = Math.min(
        (viewWidth - 32) / liveWorld.width,
        (viewHeight - 32) / liveWorld.height,
      );
      const offsetX = (viewWidth - liveWorld.width * scale) / 2;
      const offsetY = (viewHeight - liveWorld.height * scale) / 2;
      const toScreen = (x, y) => ({
        x: offsetX + x * scale,
        y: offsetY + y * scale,
      });

      const sceneKey = `${viewWidth}:${viewHeight}:${liveWorld.width}:${liveWorld.height}`;
      if (sceneKey !== staticSceneKey) {
        drawStaticScene(liveWorld, scale, offsetX, offsetY);
        staticSceneKey = sceneKey;
      }

      dynamicLayer.removeChildren();

      const selfUser = liveUsers.find((user) => user.userId === userIdRef.current);
      if (selfUser) {
        const selfPos = toScreen(selfUser.x, selfUser.y);
        const aura = new Graphics();
        aura
          .circle(selfPos.x, selfPos.y, liveRadius * scale)
          .fill({ color: 0x0ea5e9, alpha: 0.12 })
          .stroke({ color: 0x0284c7, width: 2, alpha: 0.45 });
        dynamicLayer.addChild(aura);
      }

      const liveUserIds = new Set(liveUsers.map((user) => user.userId));
      for (const knownUserId of [...smoothedUsersRef.current.keys()]) {
        if (!liveUserIds.has(knownUserId)) {
          smoothedUsersRef.current.delete(knownUserId);
        }
      }

      const labelStyle = new TextStyle({
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: Math.max(10, 14 * scale),
        fill: '#0f172a',
        fontWeight: '700',
        align: 'center',
      });
      const emojiStyle = new TextStyle({
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
        fontSize: Math.max(11, 20 * scale),
        align: 'center',
      });

      for (const user of liveUsers) {
        const previous = smoothedUsersRef.current.get(user.userId) || {
          x: user.x,
          y: user.y,
        };
        const blend = user.userId === userIdRef.current ? 1 : REMOTE_SMOOTH_BLEND;
        const smoothX = previous.x + (user.x - previous.x) * blend;
        const smoothY = previous.y + (user.y - previous.y) * blend;
        smoothedUsersRef.current.set(user.userId, { x: smoothX, y: smoothY });

        const position = toScreen(smoothX, smoothY);
        const isSelf = user.userId === userIdRef.current;
        const isConnected = connectedPeerIds.has(user.userId);
        const baseTone = tones[hashIndex(user.userId, tones.length)];

        const avatar = new Graphics();
        avatar
          .circle(position.x, position.y, Math.max(8, 12 * scale))
          .fill(isSelf ? 0xf97316 : isConnected ? 0x22c55e : baseTone)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.92 })
          .circle(position.x + Math.max(11, 14 * scale), position.y + Math.max(11, 14 * scale), Math.max(2.6, 4 * scale))
          .fill(0x34d399)
          .stroke({ width: 1, color: 0x052e16, alpha: 0.85 });
        dynamicLayer.addChild(avatar);

        const emoji = new Text({
          text: user.avatarEmoji || '🧑‍🚀',
          style: emojiStyle,
        });
        emoji.anchor.set(0.5, 0.5);
        emoji.position.set(position.x, position.y);
        dynamicLayer.addChild(emoji);

        const label = new Text({ text: user.name, style: labelStyle });
        label.anchor.set(0.5, 1.95);
        label.position.set(position.x, position.y + 2);
        dynamicLayer.addChild(label);
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [world, radius]);

  useEffect(() => {
    if (!hasEnteredName || !playerName) {
      return undefined;
    }

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('user:register', {
        name: playerName,
        avatarEmoji: playerAvatar,
      });
    });

    socket.on('connect_error', (error) => {
      setStatus('disconnected');
      const message = error?.message || 'Socket connection failed.';
      setCallError(`Connection error: ${message}`);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
      setConnections([]);
      setActiveRoomId('');
      setActivePeerUserId('');
      endCurrentCall(false);
    });

    socket.on('world:init', (payload) => {
      userIdRef.current = payload.you.userId;
      playerPosRef.current = { x: payload.you.x, y: payload.you.y };
      lastMoveEmitPosRef.current = { x: payload.you.x, y: payload.you.y };
      setWorld(payload.world);
      setRadius(payload.radius);
      targetUsersRef.current = payload.users;
      setUsers(payload.users);
      lastUiSyncRef.current = performance.now();
    });

    socket.on('world:update', (payload) => {
      const previousUserCount = targetUsersRef.current.length;
      const serverSelf = payload.users.find(
        (user) => user.userId === userIdRef.current,
      );

      let mergedUsers = payload.users;
      if (serverSelf) {
        const isLocallyMoving = pressedKeysRef.current.size > 0;
        const drift = Math.hypot(
          serverSelf.x - playerPosRef.current.x,
          serverSelf.y - playerPosRef.current.y,
        );

        if (drift > SELF_HARD_SNAP_DISTANCE) {
          playerPosRef.current = { x: serverSelf.x, y: serverSelf.y };
        } else if (!isLocallyMoving && drift > SELF_CORRECTION_DISTANCE) {
          playerPosRef.current = {
            x:
              playerPosRef.current.x +
              (serverSelf.x - playerPosRef.current.x) * SELF_SERVER_BLEND,
            y:
              playerPosRef.current.y +
              (serverSelf.y - playerPosRef.current.y) * SELF_SERVER_BLEND,
          };
        }

        mergedUsers = payload.users.map((user) =>
          user.userId === userIdRef.current
            ? {
                ...user,
                x: playerPosRef.current.x,
                y: playerPosRef.current.y,
              }
            : user,
        );
      }

      targetUsersRef.current = mergedUsers;

      const now = performance.now();
      if (
        now - lastUiSyncRef.current > UI_SYNC_INTERVAL_MS ||
        mergedUsers.length !== previousUserCount
      ) {
        setUsers(mergedUsers);
        lastUiSyncRef.current = now;
      }
    });

    socket.on('connections:update', ({ activeConnections }) => {
      const previousRoomId = activeRoomRef.current;
      const previousPeerUserId = activePeerRef.current;

      let nextRoomId = previousRoomId;
      if (!nextRoomId || !activeConnections.some((item) => item.roomId === nextRoomId)) {
        nextRoomId = activeConnections[0]?.roomId || '';
      }

      const roomConnections = activeConnections.filter(
        (item) => item.roomId === nextRoomId,
      );

      let nextPeerUserId = previousPeerUserId;
      if (!nextPeerUserId || !roomConnections.some((item) => item.peerUserId === nextPeerUserId)) {
        nextPeerUserId = roomConnections[0]?.peerUserId || '';
      }

      setConnections(activeConnections);
      setActiveRoomId(nextRoomId);
      setActivePeerUserId(nextPeerUserId);
    });

    socket.on('chat:message', (message) => {
      setMessagesByRoom((prev) => {
        const roomMessages = prev[message.roomId] || [];
        return {
          ...prev,
          [message.roomId]: [...roomMessages, message],
        };
      });
    });

    socket.on('rtc:call-request', (payload = {}) => {
      const roomId = String(payload.roomId || '');
      const fromUserId = String(payload.fromUserId || '');
      if (!roomId || !fromUserId) {
        return;
      }

      const activeCall = currentCallRef.current;
      if (
        callStateRef.current === 'ringing-outgoing' ||
        activeCall.roomId &&
        (activeCall.roomId !== roomId || activeCall.peerUserId !== fromUserId)
      ) {
        socket.emit('rtc:call-reject', {
          roomId,
          targetUserId: fromUserId,
        });
        return;
      }

      setIncomingCall({
        roomId,
        fromUserId,
        fromName: payload.fromName,
        fromAvatarEmoji: payload.fromAvatarEmoji,
      });
      callStateRef.current = 'ringing-incoming';
      setCallState('ringing-incoming');

      if (activeRoomRef.current !== roomId) {
        setActiveRoomId(roomId);
      }
      setActivePeerUserId(fromUserId);
    });

    socket.on('rtc:call-accept', (payload = {}) => {
      const roomId = String(payload.roomId || '');
      const fromUserId = String(payload.fromUserId || '');
      if (!roomId || !fromUserId || callStateRef.current !== 'ringing-outgoing') {
        return;
      }

      createAndSendOffer(roomId, fromUserId);
    });

    socket.on('rtc:call-reject', (payload = {}) => {
      const roomId = String(payload.roomId || '');
      const fromUserId = String(payload.fromUserId || '');
      const pendingIncoming = incomingCallRef.current;

      if (
        pendingIncoming &&
        pendingIncoming.roomId === roomId &&
        pendingIncoming.fromUserId === fromUserId
      ) {
        setIncomingCall(null);
      }

      if (
        currentCallRef.current.roomId === roomId &&
        currentCallRef.current.peerUserId === fromUserId
      ) {
        endCurrentCall(false);
        return;
      }

      if (callStateRef.current === 'ringing-outgoing') {
        setCallState('idle');
        setCallError('Call declined or canceled.');
      }
    });

    socket.on('rtc:offer', async (payload = {}) => {
      const roomId = String(payload.roomId || '');
      const fromUserId = String(payload.fromUserId || '');
      if (!roomId || !fromUserId || !payload.sdp) {
        return;
      }

      if (activeRoomRef.current !== roomId) {
        setActiveRoomId(roomId);
      }
      setActivePeerUserId(fromUserId);

      try {
        await ensureLocalStream();
      } catch (error) {
        callStateRef.current = 'error';
        setCallState('error');
        setCallError('Allow microphone and camera access to answer calls.');
        return;
      }

      try {
        const connection = ensurePeerConnection(roomId, fromUserId);
        await connection.setRemoteDescription(payload.sdp);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        socket.emit('rtc:answer', {
          roomId,
          targetUserId: fromUserId,
          sdp: answer,
        });
      } catch (error) {
        callStateRef.current = 'error';
        setCallState('error');
        setCallError('Could not establish call. Try reconnecting users.');
      }
    });

    socket.on('rtc:answer', async (payload = {}) => {
      const currentCall = currentCallRef.current;
      if (
        !payload.sdp ||
        currentCall.roomId !== payload.roomId ||
        currentCall.peerUserId !== payload.fromUserId ||
        !peerConnectionRef.current
      ) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(payload.sdp);
      } catch (error) {
        callStateRef.current = 'error';
        setCallState('error');
        setCallError('Could not complete call handshake.');
      }
    });

    socket.on('rtc:ice-candidate', async (payload = {}) => {
      const currentCall = currentCallRef.current;
      if (
        !payload.candidate ||
        currentCall.roomId !== payload.roomId ||
        currentCall.peerUserId !== payload.fromUserId ||
        !peerConnectionRef.current
      ) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(payload.candidate);
      } catch {
        // Ignore late ICE candidates for closed calls.
      }
    });

    socket.on('rtc:hangup', (payload = {}) => {
      const currentCall = currentCallRef.current;
      const pendingIncoming = incomingCallRef.current;
      if (
        currentCall.roomId === payload.roomId &&
        currentCall.peerUserId === payload.fromUserId
      ) {
        endCurrentCall(false);
      }

      if (
        pendingIncoming &&
        pendingIncoming.roomId === payload.roomId &&
        pendingIncoming.fromUserId === payload.fromUserId
      ) {
        setIncomingCall(null);
      }

      if (callStateRef.current === 'ringing-outgoing') {
        callStateRef.current = 'idle';
        setCallState('idle');
      }
    });

    return () => {
      endCurrentCall(false);
      socket.disconnect();
    };
  }, [hasEnteredName, playerAvatar, playerName]);

  useEffect(() => {
    let previousFrameTime = performance.now();
    let rafId;

    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) {
        return false;
      }

      const tag = target.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      );
    };

    const onKeyDown = (event) => {
      if (!isMovementEnabled || isUiLocked) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
        pressedKeysRef.current.add(key);
      }
    };

    const onKeyUp = (event) => {
      if (!isMovementEnabled || isUiLocked) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      pressedKeysRef.current.delete(event.key.toLowerCase());
    };

    const step = (now) => {
      const socket = socketRef.current;
      const dt = Math.min((now - previousFrameTime) / 1000, 0.05);
      previousFrameTime = now;

      if (!isMovementEnabled || isUiLocked) {
        rafId = requestAnimationFrame(step);
        return;
      }

      const keys = pressedKeysRef.current;
      let dx = 0;
      let dy = 0;
      const stepDistance = PLAYER_SPEED * dt;

      if (keys.has('w') || keys.has('arrowup')) {
        dy -= 1;
      }
      if (keys.has('s') || keys.has('arrowdown')) {
        dy += 1;
      }
      if (keys.has('a') || keys.has('arrowleft')) {
        dx -= 1;
      }
      if (keys.has('d') || keys.has('arrowright')) {
        dx += 1;
      }

      if ((dx !== 0 || dy !== 0) && userIdRef.current) {
        const magnitude = Math.hypot(dx, dy) || 1;
        const normalizedDx = dx / magnitude;
        const normalizedDy = dy / magnitude;
        const nextX = clamp(
          playerPosRef.current.x + normalizedDx * stepDistance,
          20,
          world.width - 20,
        );
        const nextY = clamp(
          playerPosRef.current.y + normalizedDy * stepDistance,
          20,
          world.height - 20,
        );

        playerPosRef.current = { x: nextX, y: nextY };

        targetUsersRef.current = targetUsersRef.current.map((user) =>
          user.userId === userIdRef.current
            ? { ...user, x: nextX, y: nextY }
            : user,
        );

        if (now - lastUiSyncRef.current > UI_SYNC_INTERVAL_MS) {
          setUsers((prev) =>
            prev.map((user) =>
              user.userId === userIdRef.current
                ? { ...user, x: nextX, y: nextY }
                : user,
            ),
          );
          lastUiSyncRef.current = now;
        }

        const movedSinceLastEmit = Math.hypot(
          nextX - lastMoveEmitPosRef.current.x,
          nextY - lastMoveEmitPosRef.current.y,
        );
        if (
          socket?.connected &&
          now - lastMoveEmitRef.current > MOVE_EMIT_INTERVAL_MS &&
          movedSinceLastEmit >= MOVE_EMIT_MIN_DISTANCE
        ) {
          socket.volatile.emit('user:move', { x: nextX, y: nextY });
          lastMoveEmitRef.current = now;
          lastMoveEmitPosRef.current = { x: nextX, y: nextY };
        }
      }

      rafId = requestAnimationFrame(step);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    rafId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [isMovementEnabled, isUiLocked, world]);

  const sendMessage = (event) => {
    event.preventDefault();
    const socket = socketRef.current;
    const text = chatInput.trim();

    if (isUiLocked) {
      showDockNotice('Unlock workspace to chat.');
      return;
    }

    if (!socket || !activeRoomId || !text) {
      return;
    }

    socket.emit('chat:send', {
      roomId: activeRoomId,
      channel: selectedChannel,
      type: 'text',
      text,
    });

    setChatInput('');
  };

  const sendSticker = (sticker) => {
    const socket = socketRef.current;
    if (isUiLocked) {
      showDockNotice('Unlock workspace to react.');
      return;
    }

    if (!socket || !activeRoomId) {
      return;
    }

    socket.emit('chat:send', {
      roomId: activeRoomId,
      channel: selectedChannel,
      type: 'sticker',
      text: sticker,
    });
  };

  function handleHeaderAudioToggle() {
    if (isUiLocked) {
      showDockNotice('Unlock workspace before changing audio.');
      return;
    }

    const nextMicEnabled = !isMicEnabled;
    setIsMicEnabled(nextMicEnabled);
    showDockNotice(nextMicEnabled ? 'Microphone unmuted.' : 'Microphone muted.');
  }

  async function handleHeaderCallButton() {
    if (callState === 'requesting-media' || callState === 'connecting' || callState === 'connected') {
      endCurrentCall(true);
      showDockNotice('Call ended.');
      return;
    }

    if (callState === 'ringing-outgoing') {
      cancelOutgoingRing();
      showDockNotice('Call canceled.');
      return;
    }

    if (callState === 'ringing-incoming') {
      await acceptIncomingCall();
      showDockNotice('Call accepted.');
      return;
    }

    if (!activeConnection) {
      showDockNotice('Connect to someone first.');
      return;
    }

    await startOutgoingCall();
    showDockNotice('Calling peer...');
  }

  function topCallButtonLabel() {
    if (callState === 'requesting-media' || callState === 'connecting' || callState === 'connected') {
      return 'End';
    }
    if (callState === 'ringing-outgoing') {
      return 'Cancel';
    }
    if (callState === 'ringing-incoming') {
      return 'Accept';
    }

    return 'Call';
  }

  function handleDockLockToggle() {
    const nextLocked = !isUiLocked;
    setIsUiLocked(nextLocked);
    pressedKeysRef.current.clear();
    if (nextLocked) {
      setIsMovementEnabled(false);
      showDockNotice('Workspace locked.');
      return;
    }

    showDockNotice('Workspace unlocked.');
  }

  async function handleDockInvite() {
    const inviteText = activeRoomId
      ? `Join me in Virtual Cosmos (${selectedNavRoom}) room link: ${activeRoomId}`
      : `Join me in Virtual Cosmos (${selectedNavRoom}).`;

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard unavailable');
      }

      await navigator.clipboard.writeText(inviteText);
      showDockNotice('Invite copied to clipboard.');
    } catch {
      showDockNotice(inviteText);
    }
  }

  function handleDockRecordToggle() {
    const nextRecording = !isRecording;
    setIsRecording(nextRecording);
    showDockNotice(nextRecording ? 'Recording indicator enabled.' : 'Recording indicator stopped.');
  }

  function handleDockMoveToggle() {
    if (isUiLocked) {
      showDockNotice('Unlock workspace before moving.');
      return;
    }

    const nextMoveEnabled = !isMovementEnabled;
    setIsMovementEnabled(nextMoveEnabled);
    if (!nextMoveEnabled) {
      pressedKeysRef.current.clear();
    }
    showDockNotice(nextMoveEnabled ? 'Movement enabled.' : 'Movement paused.');
  }

  function handleDockHand() {
    if (!activeRoomId) {
      showDockNotice('Connect to someone first.');
      return;
    }

    sendSticker('✋');
    showDockNotice('Hand raised.');
  }

  function handleDockReact() {
    if (!activeRoomId) {
      showDockNotice('Connect to someone first.');
      return;
    }

    sendSticker(randomFrom(STICKER_OPTIONS));
    showDockNotice('Reaction sent.');
  }

  function handleDockTimerToggle() {
    if (timerSeconds > 0) {
      setTimerSeconds(0);
      showDockNotice('Timer stopped.');
      return;
    }

    setTimerSeconds(300);
    showDockNotice('5 minute timer started.');
  }

  function handleDockAction() {
    if (isUiLocked) {
      showDockNotice('Unlock workspace before quick action.');
      return;
    }

    const target = ROOM_CENTERS[selectedNavRoom];
    if (!target || !userIdRef.current) {
      showDockNotice('Select Room 1, Room 2, or Room 3.');
      return;
    }

    const nextX = clamp(target.x, 20, world.width - 20);
    const nextY = clamp(target.y, 20, world.height - 20);
    const now = performance.now();

    playerPosRef.current = { x: nextX, y: nextY };
    targetUsersRef.current = targetUsersRef.current.map((user) =>
      user.userId === userIdRef.current
        ? { ...user, x: nextX, y: nextY }
        : user,
    );
    setUsers((prev) =>
      prev.map((user) =>
        user.userId === userIdRef.current
          ? { ...user, x: nextX, y: nextY }
          : user,
      ),
    );
    lastUiSyncRef.current = now;

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.volatile.emit('user:move', { x: nextX, y: nextY });
      lastMoveEmitRef.current = now;
      lastMoveEmitPosRef.current = { x: nextX, y: nextY };
    }

    showDockNotice(`Moved to ${selectedNavRoom}.`);
  }

  useEffect(() => {
    return () => {
      teardownPeerConnection();
      stopLocalMedia();
    };
  }, []);

  return (
    <main className="gather-shell">
      {!hasEnteredName ? (
        <div className="join-overlay">
          <form className="join-card" onSubmit={handleJoinSubmit}>
            <h2>Enter Your Name</h2>
            <p>This name will be shown on your avatar and in chat.</p>
            <input
              value={nameDraft}
              onChange={(event) => {
                setNameDraft(event.target.value);
                if (nameError) {
                  setNameError('');
                }
              }}
              maxLength={24}
              placeholder="Type your name"
              autoFocus
            />
            {nameError ? <span className="join-error">{nameError}</span> : null}
            <button type="submit">Join Cosmos</button>
          </form>
        </div>
      ) : null}

      <aside className="left-rail">
        <div className="brand-block">
          <h1>Virtual Cosmos</h1>
          <p>Space</p>
        </div>

        <input
          className="search-box"
          type="search"
          value={navQuery}
          onChange={(event) => setNavQuery(event.target.value)}
          placeholder="Search rooms/channels"
          aria-label="Search rooms and channels"
        />

        <section className="menu-group">
          <h2>Rooms</h2>
          {filteredRooms.map((room) => (
            <button
              key={room}
              type="button"
              className={room === selectedNavRoom ? 'menu-item active' : 'menu-item'}
              onClick={() => setSelectedNavRoom(room)}
            >
              {room}
            </button>
          ))}
          {filteredRooms.length === 0 ? <p className="menu-empty">No rooms found</p> : null}
        </section>

        <section className="menu-group">
          <h2>Channels</h2>
          {filteredChannels.map((channel) => (
            <button
              key={channel}
              type="button"
              className={channel === selectedChannel ? 'menu-item active' : 'menu-item'}
              onClick={() => setSelectedChannel(channel)}
            >
              #{channel}
            </button>
          ))}
          {filteredChannels.length === 0 ? <p className="menu-empty">No channels found</p> : null}
        </section>

        <section className="member-list">
          <h2>Team</h2>
          {users.slice(0, 6).map((user) => (
            <article key={user.userId} className="member-row">
              <span className="avatar-chip">
                <img src={avatarImageUrl(user.userId || user.name)} alt="" />
              </span>
              <div>
                <h3>{user.name}</h3>
                <p>{user.userId === userIdRef.current ? 'You' : 'Online'}</p>
              </div>
            </article>
          ))}
        </section>
      </aside>

      <section className="center-stage">
        <header className="stage-top">
          <div className="room-title">{selectedNavRoom}</div>
          <div className="stage-actions">
            <button
              type="button"
              className={isMicEnabled ? 'active' : ''}
              onClick={handleHeaderAudioToggle}
              title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isMicEnabled ? '🎧' : '🔇'}
            </button>
            <button
              type="button"
              className={callState === 'connected' ? 'danger' : ''}
              onClick={handleHeaderCallButton}
              title="Quick call action"
            >
              📞 {topCallButtonLabel()}
            </button>
            <div className={`status-pill status-${status}`}>
              {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Disconnected'}
            </div>
          </div>
        </header>

        {connectedAvatarUsers.length > 0 ? (
          <aside
            ref={avatarPopupRef}
            className={[
              'avatar-popup',
              isDraggingAvatarPopup ? 'dragging' : '',
              isAvatarPopupMinimized ? 'minimized' : '',
            ].filter(Boolean).join(' ')}
            style={{
              '--avatar-popup-x': `${avatarPopupPos.x}px`,
              '--avatar-popup-y': `${avatarPopupPos.y}px`,
              '--avatar-popup-zoom': avatarPopupZoom,
            }}
          >
            <div className="avatar-popup-head">
              <div className="avatar-popup-handle" onPointerDown={handleAvatarPopupPointerDown}>
                <h3>Connected Users</h3>
                <span>Drag</span>
              </div>

              <div className="avatar-popup-zoom-controls">
                <button
                  type="button"
                  onClick={handleAvatarPopupMinimizeToggle}
                  title={isAvatarPopupMinimized ? 'Expand' : 'Minimize'}
                >
                  {isAvatarPopupMinimized ? '▢' : '—'}
                </button>
                <button
                  type="button"
                  onClick={handleAvatarPopupZoomOut}
                  title="Zoom out"
                  disabled={avatarPopupZoom <= 0.75}
                >
                  -
                </button>
                <span>{Math.round(avatarPopupZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={handleAvatarPopupZoomIn}
                  title="Zoom in"
                  disabled={avatarPopupZoom >= 1.35}
                >
                  +
                </button>
              </div>
            </div>

            <section className="avatar-popup-strip">
              {connectedAvatarUsers.map((user) => {
                const theme = avatarCardTheme(user.userId || user.name);
                return (
                  <article
                    key={user.userId}
                    className={user.userId === userIdRef.current ? 'hero-avatar me' : 'hero-avatar'}
                    style={{
                      '--avatar-card-bg': theme.background,
                      '--avatar-card-border': theme.border,
                    }}
                  >
                    <div className="hero-avatar-media">
                      <img src={avatarImageUrl(user.userId || user.name)} alt={`${user.name} avatar`} />
                    </div>

                    <div className="hero-avatar-name">{user.name}</div>
                    <div className="hero-card-icons">
                      <span>🎤</span>
                      <span>📷</span>
                    </div>
                    <i className="hero-status-dot" />
                  </article>
                );
              })}
            </section>
          </aside>
        ) : null}

        <section className="main-grid">
          <div className="map-stage">
            <div ref={canvasContainerRef} className="cosmos-canvas" />
            <div className="legend-row">
              <span><i className="dot me" /> You</span>
              <span><i className="dot peer" /> Auto connection (room/radius)</span>
              <span><i className="dot crowd" /> Other users</span>
            </div>
          </div>

          <aside className="chat-dock">
            <h2>Chat & Calls</h2>
            <p className="muted">
              {`Channel: #${selectedChannel}`}
            </p>
            <p className="muted">
              {connections.length > 0
                ? `${activeConnection?.roomName || 'Room'} members online: ${activeConnection?.roomMemberCount || connections.length + 1}`
                : 'Enter same room or move into radius to auto-connect.'}
            </p>

            <div className="connections-list">
              {connections.map((connection) => (
                <button
                  key={`${connection.roomId}:${connection.peerUserId}`}
                  className={
                    connection.roomId === activeRoomId &&
                    connection.peerUserId === activePeerUserId
                      ? 'conn active'
                      : 'conn'
                  }
                  onClick={() => {
                    setActiveRoomId(connection.roomId);
                    setActivePeerUserId(connection.peerUserId);
                  }}
                >
                  <span>{connection.peerAvatarEmoji || '🧑‍🚀'}</span>
                  {connection.peerName}
                </button>
              ))}
            </div>

            {activeRoomId ? (
              <>
                <section className="call-shell">
                  <div className="call-head">
                    <h3>
                      Call with {activeConnection?.peerAvatarEmoji || '🧑‍🚀'} {activeConnection?.peerName || 'Peer'}
                    </h3>
                    <p>{callStatusLabel(callState)}</p>
                  </div>

                  <p className="media-health">
                    {mediaCapabilities.audio ? 'Mic ready' : 'Mic unavailable'} · {mediaCapabilities.video ? 'Cam ready' : 'Cam unavailable'}
                  </p>

                  {incomingCall && callState === 'ringing-incoming' ? (
                    <p className="ringing-banner">
                      Incoming call from {incomingCall.fromAvatarEmoji || '🧑‍🚀'} {incomingCall.fromName || 'Peer'}
                    </p>
                  ) : null}

                  {callState === 'ringing-outgoing' ? (
                    <p className="ringing-banner">Calling {activeConnection?.peerName || 'peer'}...</p>
                  ) : null}

                  {(callState === 'requesting-media' || callState === 'connecting' || callState === 'connected') ? (
                    <div className="video-grid">
                      <article className="video-tile">
                        <video ref={remoteVideoRef} autoPlay playsInline />
                        <span>{activeConnection?.peerAvatarEmoji || '🧑‍🚀'} Remote</span>
                      </article>
                      <article className="video-tile self-video">
                        <video ref={localVideoRef} autoPlay muted playsInline />
                        <span>{playerAvatar} You</span>
                      </article>
                    </div>
                  ) : null}

                  <div className="call-actions">
                    {callState === 'idle' ? (
                      <button type="button" className="call-btn primary" onClick={startOutgoingCall}>
                        Start Call
                      </button>
                    ) : null}

                    {callState === 'ringing-incoming' ? (
                      <>
                        <button type="button" className="call-btn success" onClick={acceptIncomingCall}>
                          Accept
                        </button>
                        <button type="button" className="call-btn danger" onClick={rejectIncomingCall}>
                          Reject
                        </button>
                      </>
                    ) : null}

                    {callState === 'ringing-outgoing' ? (
                      <button type="button" className="call-btn danger" onClick={cancelOutgoingRing}>
                        Cancel
                      </button>
                    ) : null}

                    {(callState === 'requesting-media' || callState === 'connecting' || callState === 'connected') ? (
                      <>
                        <button type="button" className="call-btn danger" onClick={() => endCurrentCall(true)}>
                          End
                        </button>
                        <button
                          type="button"
                          className={isMicEnabled ? 'call-btn ghost active' : 'call-btn ghost'}
                          onClick={() => setIsMicEnabled((current) => !current)}
                        >
                          {isMicEnabled ? 'Mic On' : 'Mic Off'}
                        </button>
                        <button
                          type="button"
                          className={isCamEnabled ? 'call-btn ghost active' : 'call-btn ghost'}
                          onClick={toggleCamera}
                        >
                          {isCamEnabled ? 'Cam On' : 'Cam Off'}
                        </button>
                        <button
                          type="button"
                          className={isScreenSharing ? 'call-btn ghost active' : 'call-btn ghost'}
                          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                        >
                          {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {callError ? <p className="call-error">{callError}</p> : null}
                </section>

                <div className="messages">
                  {activeMessages.map((message, index) => (
                    <article
                      key={`${message.timestamp}-${index}`}
                      className={
                        message.senderUserId === userIdRef.current
                          ? 'message own'
                          : 'message'
                      }
                    >
                      <h3>
                        <span className="msg-avatar">{message.senderAvatarEmoji || '🧑‍🚀'}</span>
                        {message.senderName}
                      </h3>
                      {message.type === 'sticker' ? (
                        <p className="sticker-content">{message.text}</p>
                      ) : (
                        <p>{message.text}</p>
                      )}
                    </article>
                  ))}
                </div>

                <form className="composer" onSubmit={sendMessage}>
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder={`Message #${selectedChannel}`}
                    maxLength={280}
                    disabled={isUiLocked}
                  />
                  <button type="submit" disabled={isUiLocked}>Send</button>
                </form>

                <div className="sticker-row">
                  {STICKER_OPTIONS.map((sticker) => (
                    <button
                      key={sticker}
                      type="button"
                      className="sticker-btn"
                      onClick={() => sendSticker(sticker)}
                      disabled={isUiLocked}
                    >
                      {sticker}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="chat-disabled">Users auto-connect when they share a room or come into radius.</div>
            )}
          </aside>
        </section>

      </section>
    </main>
  );
}

export default App;

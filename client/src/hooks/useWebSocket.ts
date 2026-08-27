import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useCosmosStore } from '../store/useCosmosStore';
import { useWebRTCStore } from '../store/useWebRTCStore';
import { ChatMessage } from '../types/chat';

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws');

export function useWebSocket(spaceId: string = 'default-alpha-cosmos') {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const { tokens, user } = useAuthStore();
  const { initWorld, upsertUser, updateUserCoords, removeUser, setProximityConnections, setIsConnected, myPosition } = useCosmosStore();
  const { addMessage } = useChatStore();
  const { incomingCall, acceptCall, endCall } = useWebRTCStore();

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const tokenParam = tokens?.access_token ? `token=${encodeURIComponent(tokens.access_token)}` : '';
    const guestName = user?.username || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    const guestAvatar = user?.profile?.avatar_emoji || '🚀';
    const query = [
      tokenParam,
      `guest_name=${encodeURIComponent(guestName)}`,
      `guest_avatar=${encodeURIComponent(guestAvatar)}`,
      `x=${myPosition.x}`,
      `y=${myPosition.y}`
    ].filter(Boolean).join('&');

    const url = `${WS_BASE_URL}/api/v1/ws/cosmos/${spaceId}?${query}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;

        if (type === 'world:init') {
          initWorld(data.space_id, data.proximity_radius, data.users);
        } else if (type === 'user:joined') {
          upsertUser(data.user);
        } else if (type === 'user:moved') {
          updateUserCoords(data.user_id, data.x, data.y);
        } else if (type === 'user:left') {
          removeUser(data.user_id);
        } else if (type === 'proximity:update') {
          setProximityConnections(data.connections || []);
        } else if (type === 'chat:message') {
          const msg: ChatMessage = {
            id: data.id || `${Date.now()}_${Math.random()}`,
            space_id: data.space_id,
            sender_id: data.sender_id,
            sender_username: data.sender_username,
            sender_display_name: data.sender_display_name,
            sender_avatar: data.sender_avatar,
            recipient_id: data.recipient_id,
            room_key: data.room_key,
            content: data.content,
            message_type: data.message_type || 'text',
            created_at: data.created_at || new Date().toISOString()
          };
          addMessage(msg);
        } else if (type === 'webrtc:call-user') {
          incomingCall(data.sender_id, data.caller_name || 'Nearby Peer', data.caller_avatar || '👤', data.call_type);
        } else if (type === 'webrtc:hangup') {
          endCall();
        }
      } catch (err) {
        console.error('Error handling WS packet:', err);
      }
    };
  }, [tokens, user, spaceId, initWorld, upsertUser, updateUserCoords, removeUser, setProximityConnections, setIsConnected, addMessage, incomingCall, endCall, myPosition.x, myPosition.y]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMovement = useCallback((x: number, y: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user:move', x, y }));
    }
  }, []);

  const sendChatMessage = useCallback((content: string, roomKey: string, recipientId?: string, messageType: 'text' | 'sticker' = 'text') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat:send',
        content,
        room_key: roomKey,
        recipient_id: recipientId,
        message_type: messageType,
        created_at: new Date().toISOString()
      }));
    }
  }, []);

  const sendSignal = useCallback((signalData: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signalData));
    }
  }, []);

  return {
    sendMovement,
    sendChatMessage,
    sendSignal,
    ws: wsRef.current
  };
}

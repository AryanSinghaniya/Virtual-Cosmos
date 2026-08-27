import { create } from 'zustand';
import { ChatMessage } from '../types/chat';

interface ChatState {
  messagesByRoom: Record<string, ChatMessage[]>;
  activeRoomKey: string;
  activePeerName: string;
  activePeerAvatar: string;
  isChatOpen: boolean;
  unreadCount: Record<string, number>;

  setActiveRoom: (roomKey: string, peerName?: string, peerAvatar?: string) => void;
  addMessage: (message: ChatMessage) => void;
  setRoomHistory: (roomKey: string, messages: ChatMessage[]) => void;
  openChatWithPeer: (roomKey: string, peerName: string, peerAvatar: string) => void;
  toggleChat: () => void;
  closeChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messagesByRoom: {},
  activeRoomKey: 'space:global',
  activePeerName: 'Cosmos Space',
  activePeerAvatar: '🌌',
  isChatOpen: false,
  unreadCount: {},

  setActiveRoom: (roomKey, peerName = 'Cosmos Space', peerAvatar = '🌌') => set((state) => ({
    activeRoomKey: roomKey,
    activePeerName: peerName,
    activePeerAvatar: peerAvatar,
    unreadCount: { ...state.unreadCount, [roomKey]: 0 }
  })),

  addMessage: (message) => set((state) => {
    const room = message.room_key || 'space:global';
    const current = state.messagesByRoom[room] || [];
    
    // Avoid duplicate message IDs
    if (current.some((m) => m.id === message.id)) {
      return state;
    }

    const isCurrentActive = state.isChatOpen && state.activeRoomKey === room;
    const nextUnread = isCurrentActive ? 0 : (state.unreadCount[room] || 0) + 1;

    return {
      messagesByRoom: {
        ...state.messagesByRoom,
        [room]: [...current, message]
      },
      unreadCount: {
        ...state.unreadCount,
        [room]: nextUnread
      }
    };
  }),

  setRoomHistory: (roomKey, messages) => set((state) => ({
    messagesByRoom: {
      ...state.messagesByRoom,
      [roomKey]: messages
    }
  })),

  openChatWithPeer: (roomKey, peerName, peerAvatar) => set((state) => ({
    activeRoomKey: roomKey,
    activePeerName: peerName,
    activePeerAvatar: peerAvatar,
    isChatOpen: true,
    unreadCount: { ...state.unreadCount, [roomKey]: 0 }
  })),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

  closeChat: () => set({ isChatOpen: false })
}));

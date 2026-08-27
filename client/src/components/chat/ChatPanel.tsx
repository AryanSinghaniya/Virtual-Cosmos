import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useCosmosStore } from '../../store/useCosmosStore';
import { useWebRTCStore } from '../../store/useWebRTCStore';
import { MessageList } from './MessageList';
import { StickerPicker } from './StickerPicker';

interface ChatPanelProps {
  onSendMessage: (content: string, roomKey: string, recipientId?: string, messageType?: 'text' | 'sticker') => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);

  const { user } = useAuthStore();
  const { proximityConnections } = useCosmosStore();
  const { messagesByRoom, activeRoomKey, activePeerName, activePeerAvatar, isChatOpen, toggleChat, setActiveRoom } = useChatStore();
  const { startCall } = useWebRTCStore();

  const currentMessages = messagesByRoom[activeRoomKey] || [];

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim(), activeRoomKey, undefined, 'text');
    setInputText('');
  };

  const handleSticker = (sticker: string) => {
    onSendMessage(sticker, activeRoomKey, undefined, 'sticker');
    setShowStickers(false);
  };

  const handleInitiateCall = (peerId: string, peerName: string, peerAvatar: string, type: 'audio' | 'video') => {
    startCall(peerId, peerName, peerAvatar, type);
  };

  return (
    <div
      className={`fixed bottom-6 left-6 z-30 transition-all duration-300 ease-in-out ${
        isChatOpen ? 'w-96 h-[500px]' : 'w-72 h-14'
      } flex flex-col bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden`}
    >
      {/* Header bar */}
      <div
        onClick={toggleChat}
        className="px-4 py-3 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-850 select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{activePeerAvatar}</span>
          <div>
            <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
              <span>{activePeerName}</span>
              {proximityConnections.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
                  {proximityConnections.length} near
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {activeRoomKey.startsWith('proximity:') ? '⚡ Proximity Spatial Room' : 'Global Cosmos Channel'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-xs">{isChatOpen ? '▼' : '▲'}</span>
        </div>
      </div>

      {isChatOpen && (
        <>
          {/* Nearby Proximity Peers Roster Strip */}
          {proximityConnections.length > 0 && (
            <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Peers:
              </span>
              {proximityConnections.map((peer) => {
                const isSelected = activeRoomKey === peer.room_key;
                return (
                  <div
                    key={peer.user_id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <button
                      onClick={() => setActiveRoom(peer.room_key, peer.display_name || peer.username, peer.avatar_emoji)}
                      className="flex items-center gap-1"
                    >
                      <span>{peer.avatar_emoji}</span>
                      <span className="font-medium text-[11px]">{peer.display_name || peer.username}</span>
                    </button>
                    {/* Call trigger */}
                    <button
                      onClick={() => handleInitiateCall(peer.user_id, peer.display_name || peer.username, peer.avatar_emoji, 'video')}
                      title="Start Video Call"
                      className="ml-1 text-emerald-400 hover:text-emerald-300 text-xs p-0.5"
                    >
                      📹
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Messages Stream */}
          <MessageList messages={currentMessages} currentUserId={user?.id} />

          {/* Sticker Tray */}
          {showStickers && (
            <div className="px-3">
              <StickerPicker onSelectSticker={handleSticker} onClose={() => setShowStickers(false)} />
            </div>
          )}

          {/* Message Input Box */}
          <form onSubmit={handleSend} className="p-3 bg-slate-800/60 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStickers(!showStickers)}
              className="text-lg p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Stickers"
            >
              😊
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send message to proximity peer..."
              className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition shadow-md"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../../types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <span className="text-3xl mb-2">💬</span>
        <p className="text-xs">No messages yet. Move close to peers or say hello!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUserId;
        const isSticker = msg.message_type === 'sticker';

        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5 text-[11px] text-slate-400">
              <span>{msg.sender_avatar}</span>
              <span className="font-semibold text-slate-300">{isMe ? 'You' : msg.sender_display_name || msg.sender_username}</span>
              <span className="text-[10px] text-slate-500">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {isSticker ? (
              <div className="text-4xl py-1 transform hover:scale-110 transition cursor-default">
                {msg.content}
              </div>
            ) : (
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/70 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            )}
          </div>
        );
      })}
      <div ref={scrollEndRef} />
    </div>
  );
};

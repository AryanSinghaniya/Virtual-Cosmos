import React from 'react';

interface StickerPickerProps {
  onSelectSticker: (emoji: string) => void;
  onClose: () => void;
}

const STICKERS = [
  '🚀', '🛰️', '🪐', '🌌', '✨', '🛸', '👾', '🔥',
  '💡', '⚡', '👏', '🎉', '💻', '🤖', '❤️', '👋'
];

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker, onClose }) => {
  return (
    <div className="p-3 bg-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl mb-2">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-700 text-xs font-semibold text-slate-300">
        <span>Cosmos Stickers</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STICKERS.map((sticker) => (
          <button
            key={sticker}
            onClick={() => onSelectSticker(sticker)}
            className="text-2xl p-2 rounded-lg hover:bg-slate-700/80 transition transform hover:scale-110 active:scale-95"
          >
            {sticker}
          </button>
        ))}
      </div>
    </div>
  );
};

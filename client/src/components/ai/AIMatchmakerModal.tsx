import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useMatchmakerStore } from '../../store/useMatchmakerStore';

export const AIMatchmakerModal: React.FC = () => {
  const { isOpen, isLoading, matches, queryText, engine, closeMatchmaker, setQueryText, searchMatches } = useMatchmakerStore();
  const { openChatWithPeer } = useChatStore();
  const [searchInput, setSearchInput] = useState(queryText);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQueryText(searchInput);
    searchMatches();
  };

  const handleStartChatWithMatch = (userId: string, displayName: string, avatar: string) => {
    const roomKey = `proximity:${userId}`;
    openChatWithPeer(roomKey, displayName, avatar);
    closeMatchmaker();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-850 via-slate-800 to-indigo-950/60 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Semantic Matchmaker</span>
                <span className="px-2 py-0.5 text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full font-mono">
                  {engine}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Vector similarity matching powered by PostgreSQL pgvector embeddings
              </p>
            </div>
          </div>
          <button
            onClick={closeMatchmaker}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-5 bg-slate-850/60 border-b border-slate-800">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by topic, skill, or project (e.g. FastAPI, pgvector, React WebRTC, AI agents)..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-2"
            >
              {isLoading ? (
                <span className="animate-spin text-sm">⟳</span>
              ) : (
                <span>⚡ Find Matches</span>
              )}
            </button>
          </form>
        </div>

        {/* Matches List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 custom-scrollbar bg-slate-950/40">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs">Computing cosine similarity across pgvector embeddings...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <span className="text-4xl block mb-2">🔍</span>
              <p className="text-sm font-semibold text-slate-400">No matching peers found</p>
              <p className="text-xs mt-1">Try a different search query or update your profile interests.</p>
            </div>
          ) : (
            matches.map((peer) => (
              <div
                key={peer.user_id}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  <div className="text-3xl p-2 rounded-xl bg-slate-800/80 border border-slate-700 flex-shrink-0">
                    {peer.avatar_emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{peer.display_name}</h4>
                      <span className="text-xs text-slate-500 font-mono">@{peer.username}</span>
                      {peer.is_online ? (
                        <span className="px-2 py-0.5 text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                          Online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] bg-slate-800 text-slate-400 rounded-full">
                          Offline
                        </span>
                      )}
                    </div>

                    {peer.bio && (
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2 max-w-lg">
                        {peer.bio}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {peer.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 text-[10px] bg-indigo-950/70 text-indigo-300 border border-indigo-800/50 rounded-md font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {peer.interests.slice(0, 3).map((interest) => (
                        <span
                          key={interest}
                          className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded-md"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <div className="text-right">
                    <div className="text-base font-extrabold text-emerald-400 font-mono">
                      {peer.similarity_score}%
                    </div>
                    <span className="text-[10px] text-slate-400 block">Affinity Score</span>
                  </div>

                  <button
                    onClick={() => handleStartChatWithMatch(peer.user_id, peer.display_name, peer.avatar_emoji)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>💬</span> Chat
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

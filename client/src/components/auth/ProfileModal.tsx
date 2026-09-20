import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarOrNameChange?: (name: string, avatar: string) => void;
}

const AVATARS = ['👨‍🚀', '👩‍🚀', '🚀', '🤖', '🛰️', '🪐', '👾', '⚡', '💻', '🐱', '🦊', '🐼', '🛸'];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onAvatarOrNameChange,
}) => {
  const { user, tokens, logout, updateProfile, isLoading, error, clearError } = useAuthStore();

  const profile = user?.profile;

  const [displayName, setDisplayName] = useState(profile?.display_name || user?.username || '');
  const [avatar, setAvatar] = useState(profile?.avatar_emoji || '👨‍🚀');
  const [bio, setBio] = useState(profile?.bio || '');
  const [skillsText, setSkillsText] = useState((profile?.skills || []).join(', '));
  const [interestsText, setInterestsText] = useState((profile?.interests || []).join(', '));
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSaveSuccess(false);

    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const interests = interestsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        display_name: displayName.trim(),
        avatar_emoji: avatar,
        bio: bio.trim(),
        skills,
        interests,
      });

      if (onAvatarOrNameChange) {
        onAvatarOrNameChange(displayName.trim() || user.username, avatar);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      // Error handled in store
    }
  };

  const handleSignOut = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20">
              {avatar}
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                <span>{displayName || user.username}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700">
                  JWT Verified
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                @{user.username} • {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
              <span>✅</span>
              <span>Pilot profile and AI vector embeddings successfully updated!</span>
            </div>
          )}

          {/* Avatar Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Pilot Emoji Avatar
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
              {AVATARS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`text-xl p-2 rounded-xl border transition shrink-0 cursor-pointer ${
                    avatar === a
                      ? 'bg-blue-600/30 border-blue-500 scale-110 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display Name / Callsign
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Username (Read-Only)
              </label>
              <input
                type="text"
                disabled
                value={`@${user.username}`}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Pilot Bio / Role
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other explorers about what you build..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Technical Skills</span>
              <span className="text-[10px] text-indigo-400 font-mono">pgvector HNSW</span>
            </label>
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="e.g. React, TypeScript, FastAPI, WebSockets"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Cosmic Interests & Passions
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="e.g. Spatial Audio, Real-time Multiplayer, AI"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Session Token Info Box */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active JWT Session
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              Bearer Token: {tokens?.access_token ? `${tokens.access_token.slice(0, 24)}...` : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Expires in {tokens?.expires_in ? `${tokens.expires_in / 3600} hours` : '24h'} • Refresh Token Rotation Active
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isLoading ? 'Saving Changes...' : '💾 Save Profile Updates'}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 font-bold rounded-xl text-xs transition cursor-pointer active:scale-[0.99]"
            >
              🚪 Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

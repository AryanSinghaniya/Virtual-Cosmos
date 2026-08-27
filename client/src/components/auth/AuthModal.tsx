import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('🚀');
  const [interestsText, setInterestsText] = useState('Python, FastAPI, React, PostgreSQL, AI');
  const [skillsText, setSkillsText] = useState('FastAPI, TypeScript, Docker, WebSockets');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isRegister) {
        const interests = interestsText.split(',').map((s) => s.trim()).filter(Boolean);
        const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean);
        await register({
          email,
          username,
          password,
          display_name: displayName || username,
          avatar_emoji: avatar,
          interests,
          skills
        });
      } else {
        await login({ email, password });
      }
      onClose();
    } catch {
      // Error handled in store
    }
  };

  const AVATARS = ['🚀', '👨‍🚀', '👩‍🚀', '🤖', '🛰️', '🪐', '👾', '⚡', '💻'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌌</span>
            <div>
              <h3 className="font-bold text-white text-sm">
                {isRegister ? 'Create Cosmos Account' : 'Welcome Back to Cosmos'}
              </h3>
              <p className="text-[11px] text-slate-400">
                JWT Authentication & Profile Management
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Avatar Emoji</label>
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`text-xl p-2 rounded-xl border transition ${
                        avatar === a ? 'bg-blue-600/30 border-blue-500 scale-110' : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aryan_dev"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Aryan Singhaniya"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. engineer@cosmos.io"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Interests (for AI pgvector matchmaking)
                </label>
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="Comma separated: Python, FastAPI, AI, WebSockets"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Technical Skills</label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Comma separated: React, TypeScript, Docker, PostGIS"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg transition mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? <span className="animate-spin text-sm">⟳</span> : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                clearError();
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

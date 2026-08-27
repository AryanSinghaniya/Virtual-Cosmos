import { create } from 'zustand';
import { AIMatchQuery, AIMatchResponse, AIMatchUser } from '../types/ai';
import { apiService } from '../services/api';

interface MatchmakerState {
  isOpen: boolean;
  isLoading: boolean;
  matches: AIMatchUser[];
  queryText: string;
  totalMatches: number;
  engine: string;
  error: string | null;

  openMatchmaker: () => void;
  closeMatchmaker: () => void;
  setQueryText: (text: string) => void;
  searchMatches: (spaceId?: string) => Promise<void>;
}

export const useMatchmakerStore = create<MatchmakerState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  matches: [],
  queryText: '',
  totalMatches: 0,
  engine: 'pgvector (HNSW Index)',
  error: null,

  openMatchmaker: () => {
    set({ isOpen: true, error: null });
    get().searchMatches();
  },

  closeMatchmaker: () => set({ isOpen: false }),

  setQueryText: (text) => set({ queryText: text }),

  searchMatches: async (spaceId) => {
    set({ isLoading: true, error: null });
    try {
      const payload: AIMatchQuery = {
        query_text: get().queryText || undefined,
        top_k: 8,
        space_id: spaceId
      };
      const res = await apiService.post<any>('/api/v1/ai/match', payload);
      const data: AIMatchResponse = res.data;

      set({
        matches: data.matches || [],
        totalMatches: data.total_matches || 0,
        engine: data.vector_search_engine || 'pgvector (HNSW)',
        isLoading: false
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || err.message || 'Matchmaker search failed',
        isLoading: false
      });
    }
  }
}));

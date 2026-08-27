export interface AIMatchUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  bio?: string;
  interests: string[];
  skills: string[];
  similarity_score: number;
  match_reasons: string[];
  is_online: boolean;
}

export interface AIMatchResponse {
  matches: AIMatchUser[];
  total_matches: number;
  query_used: string;
  vector_search_engine: string;
}

export interface AIMatchQuery {
  query_text?: string;
  interests_filter?: string[];
  top_k?: number;
  space_id?: string;
}

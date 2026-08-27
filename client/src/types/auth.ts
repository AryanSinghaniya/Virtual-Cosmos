export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  bio?: string;
  interests: string[];
  skills: string[];
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
  profile?: Profile;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  display_name?: string;
  avatar_emoji?: string;
  bio?: string;
  interests?: string[];
  skills?: string[];
}

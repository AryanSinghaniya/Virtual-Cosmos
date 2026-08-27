const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiService {
  private token: string | null = null;

  setAuthToken(token: string | null) {
    this.token = token;
  }

  clearAuthToken() {
    this.token = null;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = `${BASE_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(res);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const contentType = res.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const error: any = new Error(
        (data && data.error && data.error.message) ||
        (data && data.detail) ||
        `HTTP ${res.status}: ${res.statusText}`
      );
      error.status = res.status;
      error.response = { data, status: res.status };
      throw error;
    }

    return data;
  }
}

export const apiService = new ApiService();

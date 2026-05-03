const API_BASE_URL = 'https://localhost:8000/api';

export interface Track {
  id: number;
  title: string;
  preview: string;
  artist: {
    name: string;
    picture_medium: string;
  };
  album: {
    title: string;
    cover_medium: string;
  };
}

// Helper to get headers with token
const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const register = async (userData: any): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Registration failed');
  }
  return response.json();
};

export const login = async (credentials: URLSearchParams): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: credentials,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }
  return response.json();
};

export const getMe = async (): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch user info');
  return response.json();
};

export const searchMusic = async (query: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  return response.json();
};

export const getChart = async (): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/chart`);
  return response.json();
};

export const getAlbum = async (id: number): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/album/${id}`);
  return response.json();
};

export const getArtist = async (id: number): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/artist/${id}`);
  return response.json();
};

export const getStreamUrl = async (trackId: number): Promise<{ url: string }> => {
  const response = await fetch(`${API_BASE_URL}/stream/${trackId}`);
  if (!response.ok) throw new Error('Failed to fetch stream URL');
  return response.json();
};

export const addFavorite = async (favorite: any): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/favorites`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(favorite),
  });
  return response.json();
};

export const getFavorites = async (): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/favorites`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
};

export const removeFavorite = async (trackId: number): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/favorites/${trackId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return response.json();
};

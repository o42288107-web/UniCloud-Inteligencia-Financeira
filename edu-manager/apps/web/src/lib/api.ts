import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Access token stored in memory only — never in sessionStorage/localStorage.
// On page reload the interceptor re-fetches a new one via the httpOnly refresh cookie.
let inMemoryToken: string | null = null;

export function setAccessToken(token: string): void { inMemoryToken = token; }
export function getAccessToken(): string | null { return inMemoryToken; }
export function clearAccessToken(): void { inMemoryToken = null; }

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(error)));
  failedQueue = [];
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers!.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{ data: { accessToken: string } }>('/auth/refresh');
        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        original.headers!.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        clearAccessToken();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── API helpers ─────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data.data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me').then((r) => r.data.data),
};

export const studentsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/students', { params }).then((r) => r.data.data),

  get: (id: string) => api.get(`/students/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    api.post('/students', data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/students/${id}`, data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/students/${id}`),

  enroll: (id: string, classId: string) =>
    api.post(`/students/${id}/enroll`, { classId }).then((r) => r.data.data),

  grades: (id: string) => api.get(`/students/${id}/grades`).then((r) => r.data.data),

  attendance: (id: string) => api.get(`/students/${id}/attendance`).then((r) => r.data.data),
};

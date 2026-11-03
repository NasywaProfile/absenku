/**
 * Absenku API Client
 * Berkomunikasi langsung dengan Laravel 11 Backend & MySQL Database
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'http://127.0.0.1:8000/api';
const TOKEN_KEY = 'absenku_auth_token';

export const ApiClient = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg);
      (error as any).status = response.status;
      (error as any).data = data;
      throw error;
    }

    return data as T;
  },

  // ================= Auth =================
  async login(email: string, password: string) {
    const res = await this.request<{ message: string; token: string; user: any }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  },

  async register(data: {
    name: string;
    email: string;
    password: string;
    employment_type?: string;
    department?: string;
    position?: string;
    phone?: string;
  }) {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async me() {
    return this.request('/me');
  },

  async updateProfile(data: any) {
    return this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async logout() {
    try {
      await this.request('/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  },

  // ================= Users =================
  async getUsers() {
    return this.request<any[]>('/users');
  },

  async approveUser(userId: string) {
    return this.request(`/users/${userId}/approve`, {
      method: 'POST',
    });
  },

  async rejectUser(userId: string, reason?: string) {
    return this.request(`/users/${userId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // ================= Office Config =================
  async getOfficeConfig() {
    return this.request('/office-config');
  },

  async updateOfficeConfig(data: any) {
    return this.request('/office-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ================= Attendance =================
  async getAttendance(params?: { user_id?: string; date?: string }) {
    const searchParams = new URLSearchParams(params as any).toString();
    const endpoint = `/attendance${searchParams ? `?${searchParams}` : ''}`;
    return this.request<any[]>(endpoint);
  },

  async getTodayAttendance() {
    return this.request('/attendance/today');
  },

  async clockIn(data: {
    clock_in_time: string;
    clock_in_lat?: number | null;
    clock_in_lng?: number | null;
    clock_in_distance_meter?: number;
    clock_in_location_status?: string;
    clock_in_status?: string;
    clock_in_late_minutes?: number;
    work_mode?: string;
    notes?: string;
  }) {
    return this.request('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ================= Leaves =================
  async getLeaves(status?: string) {
    const endpoint = `/leaves${status ? `?status=${status}` : ''}`;
    return this.request<any[]>(endpoint);
  },

  async createLeave(data: any) {
    return this.request('/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveLeave(id: string) {
    return this.request(`/leaves/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectLeave(id: string, reason?: string) {
    return this.request(`/leaves/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deleteLeave(id: string) {
    return this.request(`/leaves/${id}`, {
      method: 'DELETE',
    });
  },

  // ================= Daily Logs & Kanban =================
  async getDailyLogs(params?: { user_id?: string; date?: string }) {
    const searchParams = new URLSearchParams(params as any).toString();
    const endpoint = `/daily-logs${searchParams ? `?${searchParams}` : ''}`;
    return this.request<any[]>(endpoint);
  },

  async saveDailyLog(data: { date: string; tasks?: string[]; notes?: string }) {
    return this.request('/daily-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getKanbanTasks() {
    return this.request<any[]>('/kanban-tasks');
  },

  async createKanbanTask(data: any) {
    return this.request('/kanban-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateKanbanTask(id: string, data: any) {
    return this.request(`/kanban-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteKanbanTask(id: string) {
    return this.request(`/kanban-tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // ================= Chat =================
  async getChatTopics() {
    return this.request<any[]>('/chat/topics');
  },

  async createChatTopic(data: any) {
    return this.request('/chat/topics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateChatTopic(id: string, data: any) {
    return this.request(`/chat/topics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getChatMessages(params?: { topic_id?: string; channel_id?: string }) {
    const searchParams = new URLSearchParams(params as any).toString();
    const endpoint = `/chat/messages${searchParams ? `?${searchParams}` : ''}`;
    return this.request<any[]>(endpoint);
  },

  async sendChatMessage(data: any) {
    return this.request('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * in-Time API Client
 * Berkomunikasi langsung dengan Laravel 11 Backend & MySQL Database
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  '/api';
const TOKEN_KEY = 'absenku_auth_token';

export const ApiClient = {
  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string | null): void {
    if (typeof localStorage === 'undefined') return;
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

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        let errorMsg = data?.message;
        if (!errorMsg) {
          if (response.status === 401) {
            errorMsg = 'Email/username atau password tidak sesuai.';
          } else if (response.status === 403) {
            errorMsg = 'Akun tidak diizinkan masuk atau belum disetujui.';
          } else {
            errorMsg = `Permintaan gagal dengan status ${response.status}`;
          }
        }
        const error = new Error(errorMsg);
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

      return data as T;
    } catch (err: any) {
      if (err?.status) {
        throw err;
      }
      const friendlyErr = new Error('Gagal terhubung ke server backend.');
      (friendlyErr as any).status = 0;
      (friendlyErr as any).isNetworkError = true;
      throw friendlyErr;
    }
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
    const res = await this.request<{ message: string; user: any; token?: string }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  },

  async checkUserStatus(id?: string, email?: string) {
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    if (email) params.set('email', email);
    return this.request<{
      id: string;
      name: string;
      email: string;
      status: string;
      role: string;
      profil_lengkap: boolean;
      user: any;
    }>(`/user-status?${params.toString()}`);
  },

  async logout() {
    try {
      await this.request('/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  },

  async forgotPassword(data: { email: string; name: string; password: string }) {
    return this.request<{ message: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        nama: data.name,
        name: data.name,
        password: data.password,
      }),
    });
  },

  async adminResetPassword(userId: string, newPassword: string, email?: string) {
    return this.request<{ message: string }>(`/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({
        password: newPassword,
        user_id: userId,
        email: email,
      }),
    });
  },

  // ================= Users =================
  async getUsers() {
    return this.request<any[]>('/users');
  },

  async approveUser(userId: string, role?: string, email?: string) {
    const targetRole = role || 'EMPLOYEE';
    const payload = { role: targetRole, peran: targetRole, email };
    return this.request(`/users/${userId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUserRole(userId: string, role: string, email?: string) {
    const payload = { role, peran: role, email };
    try {
      return await this.request(`/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return await this.request(`/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }).catch(() => null);
    }
  },

  async updateEmploymentType(userId: string, employmentType: string, email?: string) {
    const payload = { employment_type: employmentType, tipe_kepegawaian: employmentType, email };
    try {
      return await this.request(`/users/${userId}/employment-type`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return await this.request(`/users/${userId}/employment-type`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }).catch(() => null);
    }
  },

  async rejectUser(userId: string, reason?: string) {
    return this.request(`/users/${userId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deleteUser(userId: string) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
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
    id?: string;
    user_id?: string;
    pengguna_id?: string;
    date?: string;
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

  async deleteAttendance(params: { date?: string; tanggal?: string; user_id?: string; pengguna_id?: string }) {
    const searchParams = new URLSearchParams(params as any).toString();
    return this.request(`/attendance${searchParams ? `?${searchParams}` : ''}`, {
      method: 'DELETE',
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

  async deleteChatTopic(id: string) {
    return this.request(`/chat/topics/${id}`, {
      method: 'DELETE',
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

  async deleteChatMessage(id: string) {
    return this.request(`/chat/messages/${id}`, {
      method: 'DELETE',
    });
  },
};

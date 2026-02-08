const API_URL = 'http://localhost:3000/api';

export const adminApi = {
  getUsers: async () => {
    const response = await fetch(`${API_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  createUser: async (user: any) => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
    }
    return response.json();
  },

  updateUser: async (id: number, user: any) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
    }
    return response.json();
  },

  deleteUser: async (id: number) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
    }
    return response.json();
  },

  getRoles: async () => {
    const response = await fetch(`${API_URL}/roles`);
    if (!response.ok) throw new Error('Failed to fetch roles');
    return response.json();
  },

  updateRolePermissions: async (name: string, permissions: string[]) => {
    const response = await fetch(`${API_URL}/roles/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    });
    if (!response.ok) throw new Error('Failed to update role permissions');
    return response.json();
  },

  getStats: async (params?: { startDate?: string; endDate?: string }) => {
    const url = new URL(`${API_URL}/stats`);
    if (params?.startDate) url.searchParams.append('startDate', params.startDate);
    if (params?.endDate) url.searchParams.append('endDate', params.endDate);
    
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  }
};

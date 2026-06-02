import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const tenantSubdomain = localStorage.getItem('tenantSubdomain') || 'demo';

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  if (!config.headers['X-Tenant-ID']) {
    config.headers['X-Tenant-ID'] = tenantSubdomain;
  }

  return config;
});


const API_BASE = '/api';
const TOKEN = 'dev-token'; // Fake token for phase 1

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${TOKEN}`);

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch (e) {
      // ignore JSON parse error
    }
    throw new Error(message);
  }

  return response;
}

export const apiClient = {
  get: async (url: string) => {
    const res = await fetchWithAuth(url);
    return res.json();
  },
  
  post: async (url: string, body: any) => {
    const isFormData = body instanceof FormData;
    const options: RequestInit = {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    };
    
    if (!isFormData) {
      options.headers = { 'Content-Type': 'application/json' };
    }
    
    const res = await fetchWithAuth(url, options);
    return res.json();
  },

  put: async (url: string, body: any) => {
    const isFormData = body instanceof FormData;
    const options: RequestInit = {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    };
    
    if (!isFormData) {
      options.headers = { 'Content-Type': 'application/json' };
    }
    
    const res = await fetchWithAuth(url, options);
    return res.json();
  },

  delete: async (url: string) => {
    const res = await fetchWithAuth(url, { method: 'DELETE' });
    if (res.status === 204) return;
    return res.json();
  },

  download: async (url: string, filename: string) => {
    const res = await fetchWithAuth(url);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  }
};

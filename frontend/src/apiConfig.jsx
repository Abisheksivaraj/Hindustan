import axios from "axios";

// API Base URL - Change this to your backend URL
const API_BASE_URL =
"http://localhost:5173";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
      return Promise.reject(error.response.data);
    } else if (error.request) {
      console.error("Network Error:", error.request);
      return Promise.reject({
        error: "Network Error",
        message: "Unable to connect to server.",
      });
    } else {
      console.error("Request Error:", error.message);
      return Promise.reject({
        error: "Request Error",
        message: error.message,
      });
    }
  }
);

// API Functions
export const labelAPI = {
  // Create label configuration
  createConfig: async (data) => {
    return await apiClient.post("/api/labels", data);
  },

  // Get all configurations
  getAllConfigs: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    return await apiClient.get(`/api/labels?${queryParams}`);
  },

  // Generate codes
  generateCodes: async (id, saveToDB = false) => {
    return await apiClient.post(`/api/labels/${id}/generate`, { saveToDB });
  },

  // Get recent configs
  getRecentConfigs: async (limit = 5) => {
    return await apiClient.get(`/api/labels/recent/list?limit=${limit}`);
  },
};

export const printHistoryAPI = {
  // Create print history
  createRecord: async (data) => {
    return await apiClient.post("/api/print-history", data);
  },

  // Get all history
  getAllHistory: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    return await apiClient.get(`/api/print-history?${queryParams}`);
  },

  // Get statistics
  getStatistics: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    return await apiClient.get(`/api/print-history/stats/summary?${queryParams}`);
  },

  // Get daily stats
  getDailyStats: async (days = 7) => {
    return await apiClient.get(`/api/print-history/stats/daily?days=${days}`);
  },
};

export const configAPI = {
  // Search label
  searchLabel: async (code) => {
    return await apiClient.get(`/api/config/search/${code}`);
  },

  // Verify code
  verifyCode: async (code) => {
    return await apiClient.get(`/api/config/verify/${code}`);
  },

  // Check health
  checkHealth: async () => {
    return await apiClient.get("/api/health");
  },
};

export default apiClient;

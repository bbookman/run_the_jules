import axios from 'axios';

// The base URL for the backend API
// This will be proxied by React's dev server (setup in package.json via "proxy")
// For production, this might need to be configured differently (e.g., environment variable)
const API_BASE_URL = '/api'; // Using relative path for proxy

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Add other common headers here, like Authorization if needed later
  },
});

// Interceptors can be added for global error handling or request/response transformations

// Request interceptor (example: add auth token)
apiClient.interceptors.request.use(
  (config) => {
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor (example: global error handling)
apiClient.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('API Response Error:', error.response || error.message || error);

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // Examples: error.response.status === 401 (Unauthorized), 403 (Forbidden), 500 (Server Error)
      // You could dispatch a global error action or redirect here
      if (error.response.status === 401) {
        // Handle unauthorized access, e.g., redirect to login
        // window.location.href = '/login';
      }
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.error('API Error: No response received from server.', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error: Error setting up request.', error.message);
    }

    // It's good practice to return a rejected promise with a standardized error object if possible
    const customError = {
        message: error.response?.data?.error?.message || error.response?.data?.message || error.message || 'An unexpected API error occurred.',
        status: error.response?.status,
        data: error.response?.data
    };
    return Promise.reject(customError);
  }
);

export default apiClient;

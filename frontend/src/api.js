import axios from 'axios'

const ACCESS_TOKEN_KEY = 'employee-management.access'
const REFRESH_TOKEN_KEY = 'employee-management.refresh'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

let refreshRequest

export function saveTokens(tokens) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access)
  sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh)
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function hasSavedTokens() {
  return Boolean(
    sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
    sessionStorage.getItem(REFRESH_TOKEN_KEY),
  )
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function logoutSession() {
  const refreshToken = getRefreshToken()
  return refreshToken
    ? axios.post('/api/auth/logout/', { refresh: refreshToken })
    : Promise.resolve()
}

function notifySessionExpired() {
  clearTokens()
  window.dispatchEvent(new Event('auth:expired'))
}

api.interceptors.request.use((config) => {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retried ||
      request.url?.includes('/auth/token/')
    ) {
      return Promise.reject(error)
    }

    request._retried = true
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      notifySessionExpired()
      return Promise.reject(error)
    }

    if (!refreshRequest) {
      refreshRequest = axios.post('/api/auth/token/refresh/', { refresh: refreshToken })
        .then(({ data }) => {
          saveTokens({ access: data.access, refresh: data.refresh || refreshToken })
          return data.access
        })
        .catch((refreshError) => {
          notifySessionExpired()
          throw refreshError
        })
        .finally(() => { refreshRequest = undefined })
    }

    try {
      const accessToken = await refreshRequest
      request.headers = request.headers || {}
      request.headers.Authorization = `Bearer ${accessToken}`
      return api(request)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export async function fetchWorkspaceData() {
  const [employees, departments, projects] = await Promise.allSettled([
    api.get('/employees/'),
    api.get('/departments/'),
    api.get('/projects/'),
  ])

  return {
    employees: employees.status === 'fulfilled' ? normalizeList(employees.value.data) : [],
    departments: departments.status === 'fulfilled' ? normalizeList(departments.value.data) : [],
    projects: projects.status === 'fulfilled' ? normalizeList(projects.value.data) : [],
    errors: [employees, departments, projects]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason),
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

export default api
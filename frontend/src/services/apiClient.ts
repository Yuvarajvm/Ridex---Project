import { useAuthStore } from '../stores/authStore'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, ...fetchOptions } = options

  const token = useAuthStore.getState().token

  const headers = new Headers(customHeaders ?? {})
  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value))
      }
    }
    const queryString = searchParams.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  if (response.status === 401) {
    // If receiving unauthorized while having a token, clear stale credentials
    if (token) {
      useAuthStore.getState().logout()
    }
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred.'
    try {
      const errorData = await response.json()
      if (typeof errorData?.detail === 'string') {
        errorMessage = errorData.detail
      } else if (Array.isArray(errorData?.detail)) {
        errorMessage = errorData.detail.map((d: { msg?: string }) => d.msg || 'Validation error').join(', ')
      }
    } catch {
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
}

apiClient.get = function <T = unknown>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'GET' })
}

apiClient.post = function <T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

apiClient.patch = function <T = unknown>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

apiClient.delete = function <T = unknown>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  return apiClient<T>(endpoint, { ...options, method: 'DELETE' })
}


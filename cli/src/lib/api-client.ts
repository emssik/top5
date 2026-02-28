export interface ApiResult<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
}

export type ApiResponse<T> = ApiResult<T> | ApiError

const TIMEOUT_MS = 5000

export class ApiClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new CliApiError('Request timed out. Is top5 running?')
      }
      throw new CliApiError(`Cannot connect to top5 at ${this.baseUrl}. Is the app running with API enabled?`)
    }

    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new CliApiError(`Unexpected response from API (status ${res.status})`)
    }

    const envelope = json as ApiResponse<T>
    if (!envelope.ok) {
      throw new CliApiError((envelope as ApiError).error || `API error (status ${res.status})`, res.status)
    }
    return (envelope as ApiResult<T>).data
  }
}

export class CliApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'CliApiError'
    this.status = status
  }
}

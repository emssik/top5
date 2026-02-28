import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiClient, CliApiError } from '../src/lib/api-client'
import { okResponse, errorResponse } from './helpers'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiClient', () => {
  const client = new ApiClient('http://127.0.0.1:15055', 'test-key-123')

  describe('Authorization header', () => {
    it('sends Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValue(okResponse({ status: 'ok' }))
      await client.get('/api/v1/health')

      expect(mockFetch).toHaveBeenCalledOnce()
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Authorization']).toBe('Bearer test-key-123')
    })

    it('omits Authorization header when apiKey is empty', async () => {
      const noKeyClient = new ApiClient('http://127.0.0.1:15055', '')
      mockFetch.mockResolvedValue(okResponse({ status: 'ok' }))
      await noKeyClient.get('/api/v1/health')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Authorization']).toBeUndefined()
    })
  })

  describe('HTTP methods', () => {
    it('GET sends correct method and URL', async () => {
      mockFetch.mockResolvedValue(okResponse([]))
      await client.get('/api/v1/projects')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('http://127.0.0.1:15055/api/v1/projects')
      expect(opts.method).toBe('GET')
      expect(opts.body).toBeUndefined()
    })

    it('POST sends correct method, URL and body', async () => {
      mockFetch.mockResolvedValue(okResponse({ id: '1' }))
      await client.post('/api/v1/projects', { name: 'Test' })

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('http://127.0.0.1:15055/api/v1/projects')
      expect(opts.method).toBe('POST')
      expect(opts.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(opts.body)).toEqual({ name: 'Test' })
    })

    it('POST without body sends no Content-Type', async () => {
      mockFetch.mockResolvedValue(okResponse({}))
      await client.post('/api/v1/projects/123/archive')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Content-Type']).toBeUndefined()
      expect(opts.body).toBeUndefined()
    })

    it('PUT sends correct method and body', async () => {
      mockFetch.mockResolvedValue(okResponse([]))
      await client.put('/api/v1/projects/123', { name: 'Updated' })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('PUT')
      expect(JSON.parse(opts.body)).toEqual({ name: 'Updated' })
    })

    it('DELETE sends correct method', async () => {
      mockFetch.mockResolvedValue(okResponse([]))
      await client.delete('/api/v1/projects/123')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('DELETE')
      expect(opts.body).toBeUndefined()
    })
  })

  describe('response handling', () => {
    it('returns data from successful response', async () => {
      mockFetch.mockResolvedValue(okResponse({ projects: ['a', 'b'] }))
      const result = await client.get<{ projects: string[] }>('/api/v1/projects')
      expect(result).toEqual({ projects: ['a', 'b'] })
    })

    it('throws CliApiError on API error response', async () => {
      mockFetch.mockResolvedValue(errorResponse(401, 'Invalid API key'))

      await expect(client.get('/api/v1/projects')).rejects.toThrow(CliApiError)
      await expect(client.get('/api/v1/projects')).rejects.toThrow('Invalid API key')
    })

    it('CliApiError includes status code', async () => {
      mockFetch.mockResolvedValue(errorResponse(404, 'Not found'))

      try {
        await client.get('/api/v1/projects/xyz')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(CliApiError)
        expect((err as CliApiError).status).toBe(404)
      }
    })

    it('throws CliApiError on 500 error', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'Internal error'))

      await expect(client.get('/api/v1/projects')).rejects.toThrow(CliApiError)
      await expect(client.get('/api/v1/projects')).rejects.toThrow('Internal error')
    })
  })

  describe('timeout', () => {
    it('passes AbortSignal.timeout to fetch', async () => {
      mockFetch.mockResolvedValue(okResponse({}))
      await client.get('/api/v1/health')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.signal).toBeDefined()
    })

    it('throws readable error on timeout', async () => {
      const timeoutErr = new Error('The operation was aborted')
      timeoutErr.name = 'TimeoutError'
      mockFetch.mockRejectedValue(timeoutErr)

      await expect(client.get('/api/v1/health')).rejects.toThrow('Request timed out')
    })
  })

  describe('network errors', () => {
    it('throws readable error on connection refused', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'))

      await expect(client.get('/api/v1/health')).rejects.toThrow('Cannot connect to top5')
    })

    it('throws CliApiError on non-JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token') },
      })

      await expect(client.get('/api/v1/health')).rejects.toThrow('Unexpected response from API')
    })
  })

  describe('Accept header', () => {
    it('always sends Accept: application/json', async () => {
      mockFetch.mockResolvedValue(okResponse({}))
      await client.get('/api/v1/health')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Accept']).toBe('application/json')
    })
  })
})

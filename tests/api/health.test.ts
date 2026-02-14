import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer } from './setup'

setupTestEnv()

describe('GET /api/v1/health', () => {
  it('returns 200 without auth', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.data.status).toBe('ok')
  })

  it('returns version', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/health' })
    const body = res.json()
    expect(body.data.version).toBeDefined()
    expect(typeof body.data.version).toBe('string')
  })
})

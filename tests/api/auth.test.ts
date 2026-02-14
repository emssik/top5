import { describe, it, expect } from 'vitest'
import { setupTestEnv, getTestServer, getTestApiKey } from './setup'

setupTestEnv()

describe('Auth', () => {
  it('returns 401 without token', async () => {
    const server = await getTestServer()
    const res = await server.inject({ method: 'GET', url: '/api/v1/projects' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: 'Bearer wrong-token' }
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with valid token', async () => {
    const server = await getTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${getTestApiKey()}` }
    })
    expect(res.statusCode).toBe(200)
  })
})

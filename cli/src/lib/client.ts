import { ApiClient } from './api-client.js'
import { resolveConfig } from './config.js'
import { die } from './output.js'

/**
 * Create an ApiClient from Commander's global options.
 * Replaces the repeated resolveConfig + new ApiClient boilerplate.
 */
export function createClient(globalOpts: { apiKey?: string; port?: string }): ApiClient {
  let config
  try {
    config = resolveConfig({ apiKey: globalOpts.apiKey, port: globalOpts.port })
  } catch (err) {
    die((err as Error).message)
  }
  return new ApiClient(`http://${config.host}:${config.port}`, config.apiKey)
}

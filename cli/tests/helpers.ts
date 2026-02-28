export function okResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, data }),
  }
}

export function errorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    json: async () => ({ ok: false, error }),
  }
}

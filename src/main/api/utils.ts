export type ServiceError = { error: string }

export function isServiceError(result: unknown): result is ServiceError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    typeof (result as { error: unknown }).error === 'string'
  )
}

export function errorToHttpStatus(error: string): number {
  if (error === 'not_found') return 404
  if (error === 'active_limit') return 409
  if (error === 'code_duplicate') return 409
  return 400
}

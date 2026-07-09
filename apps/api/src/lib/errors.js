export class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

export function errorMiddleware(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'
  if (status >= 500) {
    console.error('[API Error]', err)
  }
  res.status(status).json({
    error: message,
    code: err.code || 'ERROR',
    ...(process.env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {}),
  })
}

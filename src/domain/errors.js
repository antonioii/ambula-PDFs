class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { AppError };

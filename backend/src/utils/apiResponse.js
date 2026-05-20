/**
 * Standard success envelope (keeps legacy `status: 'success'` for existing clients).
 */
function sendSuccess(res, { statusCode = 200, message, data = {} } = {}) {
  const body = {
    success: true,
    status: 'success',
    data,
  };
  if (message) {
    body.message = message;
  }
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };

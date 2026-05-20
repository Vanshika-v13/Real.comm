const { validationResult } = require('express-validator');
const { mapExpressValidatorErrors } = require('../utils/validationFormat');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = mapExpressValidatorErrors(result);
    return res.status(400).json({
      success: false,
      status: 'fail',
      message: errors[0]?.message || 'Validation failed',
      errors,
    });
  }
  return next();
}

module.exports = validateRequest;

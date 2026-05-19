/**
 * Maps express-validator results to a stable API error shape.
 * @param {import('express-validator').Result} result
 * @returns {Array<{ field: string, message: string }>}
 */
function mapExpressValidatorErrors(result) {
  return result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));
}

module.exports = { mapExpressValidatorErrors };

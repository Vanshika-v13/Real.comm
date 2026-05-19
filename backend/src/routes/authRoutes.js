const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const { registerRules, loginRules } = require('../validators/authValidators');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests, please try again later' },
});

router.use(authLimiter);

router.post(
  '/register',
  registerRules,
  validateRequest,
  authController.register,
);

router.post('/login', loginRules, validateRequest, authController.login);

router.get('/me', protect, authController.getMe);

module.exports = router;

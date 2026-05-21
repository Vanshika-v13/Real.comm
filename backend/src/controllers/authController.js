const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateToken } = require('../utils/tokenUtils');
const { formatPublicUser } = require('../utils/userProfileFormat');

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    status: 'success',
    data: {
      user: formatPublicUser(user),
      token,
    },
  });
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, profileImage } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const user = await User.create({ name, email, password, profileImage });
  sendTokenResponse(user, 201, res);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  sendTokenResponse(user, 200, res);
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      user: formatPublicUser(req.user),
    },
  });
});

module.exports = {
  register,
  login,
  getMe,
};

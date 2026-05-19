const express = require('express');
const fileController = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const validateRequest = require('../middleware/validate');
const { mongoObjectIdParamRules } = require('../validators/commonValidators');

const router = express.Router();

router.use(protect);

router.get(
  '/:fileId/download',
  ...mongoObjectIdParamRules('fileId'),
  validateRequest,
  fileController.download,
);

module.exports = router;

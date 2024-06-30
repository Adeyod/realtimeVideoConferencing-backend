import express from 'express';
import {
  emailVerification,
  loginUser,
  logoutUser,
  registerUser,
  forgotPassword,
  resetPassword,
  allowResetPassword,
  updateProfile,
} from '../controllers/userController.js';
import { authUser } from '../middlewares/jwtAuth.js';
import multerUpload from '../middlewares/multer.js';

const router = express.Router();

router.post('/register', registerUser);
router.post(
  '/update-profile',
  multerUpload.single('image'),
  authUser,
  updateProfile
);
router.post('/forgot-password', forgotPassword);
router.post('/allow-reset-password/:userId/:token', allowResetPassword);
router.post('/reset-password/:userId/:token', resetPassword);
router.post('/logout', logoutUser);
router.post('/email-verification/:userId/:token', emailVerification);
router.post('/login', loginUser);

export default router;

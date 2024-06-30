import express from 'express';
import { authUser } from '../middlewares/jwtAuth.js';
import {
  instantMeeting,
  createMeetingForLater,
  joinMeetingById,
} from '../controllers/meetingController.js';

const router = express.Router();

router.post('/instant-meeting', authUser, instantMeeting);
router.post('/create-meeting', authUser, createMeetingForLater);
router.post('/join-meeting/:meetingId/:participant', joinMeetingById);

export default router;

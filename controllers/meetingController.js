import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import Meeting from '../models/meetingModel.js';
import User from '../models/userModel.js';
import { meetingNotification } from '../middlewares/nodemailer.js';

const instantMeeting = async (req, res) => {
  try {
    const { email } = req.body;
    const checkEmail = await User.findOne({ email: email });

    if (!checkEmail) {
      return res.json({
        error: 'Email not found',
        status: 404,
        success: false,
      });
    }
    const meetingId = uuidv4();
    const user = req.user;
    const meetingLink = `${process.env.FRONTEND_URL}/meeting-room/${meetingId}`;
    const userEmail = user.email;

    const newMeeting = await new Meeting({
      meetingId,
      meetingLink,
      createdBy: user._id,
      participants: [userEmail],
      waitingRoom: [],
    }).save();
    console.log('i get to this place for meeting');

    if (!newMeeting) {
      return res.json({
        error: 'Could not create meeting',
        success: false,
        status: 400,
      });
    }

    res.json({
      message: 'Meeting created successfully',
      success: true,
      status: 201,
      meetingDetails: {
        meeting: newMeeting,
      },
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const createMeetingForLater = async (req, res) => {
  try {
    const { emails, creator, dateTime, title } = req.body;
    if (!emails || !creator || !dateTime || !title) {
      return res.json({
        error: 'All fields are required',
        status: 400,
        success: false,
      });
    }

    let expectedParticipants = [];
    let participants = [];
    const meetingId = uuidv4();
    const meetingLink = `${process.env.FRONTEND_URL}/meeting-room?meetingId=${meetingId}`;

    emails.map((email) => {
      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.json({
          error: 'Invalid email address',
          success: false,
          status: 400,
        });
      }
      const emailId = uuidv4();
      const uniqueMeetingLink = `${process.env.FRONTEND_URL}/meeting-room?meetingId=${meetingId}&participant=${emailId}`;
      const eachEmailObj = {
        email,
        uniqueId: emailId,
        uniqueMeetingLink,
      };
      expectedParticipants.push(eachEmailObj);
    });

    const user = await User.findById({ _id: creator }).select(
      'firstName email'
    );

    const creatorDetails = {
      email: user.email,
      uniqueId: user._id,
      uniqueMeetingLink: `${process.env.FRONTEND_URL}/meeting-room?meetingId=${meetingId}&participant=${user._id}`,
    };

    participants.push(creatorDetails);
    const newMeeting = await new Meeting({
      title,
      meetingId,
      meetingLink,
      expectedParticipants,
      createdBy: creator,
      participants: participants,
      dateTime: moment(dateTime).utc().toDate(),
    }).save();

    // At this point, send meeting notification to expected participants
    newMeeting.expectedParticipants.map(async (expectedParticipant) => {
      await meetingNotification({
        title: newMeeting.title,
        email: expectedParticipant.email,
        date: newMeeting.dateTime,
        creatorEmail: user.email,
        creatorName: user.firstName,
        link: expectedParticipant.uniqueMeetingLink,
      });
    });

    return res.json({
      message: `Meeting created successfully. We have also sent mails to notify all the ${emails.length} participants`,
      success: true,
      status: 201,
      meetingDetails: newMeeting,
    });
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const joinMeetingById = async (req, res) => {
  try {
    const { meetingId, participant } = req.params;
    // console.log(participant);

    let findParticipant;
    let checkParticipantsArray;
    let checkWaitingRoom;
    let userDetails;

    const meeting = await Meeting.findOne({ meetingId: meetingId });

    if (!meeting) {
      return res.json({
        error: 'Meetings could not be found',
        status: 404,
        success: false,
      });
    }

    // console.log('object');

    if (participant === meeting.createdBy.toString()) {
      console.log('creator already in the meeting');
      console.log(participant);

      const userDetails = meeting.participants.find(
        (participant) => participant.uniqueId === participant
      );
      return res.json({
        message: 'Creator already in the meeting',
        success: true,
        status: 200,
        meetingDetails: {
          meeting,
          userDetails,
        },
      });
    } else {
      findParticipant = meeting.expectedParticipants.find(
        (p) => p.uniqueId === participant
      );

      // console.log('findParticipant:', findParticipant);

      checkParticipantsArray = meeting.participants.find(
        (p) => p.uniqueId === participant
      );

      // console.log('checkParticipantsArray:', checkParticipantsArray);

      checkWaitingRoom = meeting.waitingRoom.find(
        (p) => p.uniqueId === participant
      );

      userDetails =
        findParticipant || checkParticipantsArray || checkWaitingRoom;

      // if (!userDetails) {
      //   console.log('I am sending back this error');
      //   return res.json({
      //     error: 'You are not booked for the meeting',
      //     success: false,
      //     status: 404,
      //   });
      // }

      // if (!findParticipant || !checkWaitingRoom || !checkParticipantsArray) {
      //   console.log('I am sending back this error');
      //   return res.json({
      //     error: 'You are not booked for the meeting',
      //     success: false,
      //     status: 404,
      //   });
      // }
    }

    if (!userDetails) {
      return res.json({
        error: 'You are not part of the meeting',
        status: 404,
        success: false,
      });
    }

    if (meeting) {
      return res.json({
        message: 'User joined successfully',
        success: true,
        status: 200,
        meetingDetails: {
          meeting,
          userDetails,
        },
      });
    }
  } catch (error) {
    console.error('Error in joinMeetingById:', error);
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const approveParticipant = async (req, res) => {
  try {
    const { meetingId, email } = req.body;
    const meeting = await Meeting.findOne({ meetingId });

    if (meeting) {
      meeting.participants.push(email);
      meeting.waitingRoom.filter((participant) => {
        participant !== email;
      });

      await meeting.save();
      return res.json({
        message: 'Participant accepted into the meeting',
        status: 200,
        success: true,
      });
    } else {
      return res.json({
        error: 'Unable to add participants',
        status: 404,
        success: false,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

// const joinMeetingById = async (req, res) => {
//   try {
//   } catch (error) {
//     return res.json({
//       error: error.message,
//       success: false,
//       status: 500,
//       message: 'Something happened',
//     });
//   }
// };

export {
  approveParticipant,
  instantMeeting,
  createMeetingForLater,
  joinMeetingById,
};

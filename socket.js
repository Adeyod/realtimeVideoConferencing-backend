import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import Meeting from './models/meetingModel.js';
import User from './models/userModel.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:5173'],
    methods: ['POST', 'GET'],
  },
  // cookie: {
  //   expires: '10m',
  // },
});

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);
  // console.log('ID', socket.handshake.query.userId);
  socket.emit('creator', socket.id);

  socket.on('join-room', async ({ meetingId, email }) => {
    try {
      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting) {
        return socket.emit('error', 'Meeting not found');
      }

      const user = await User.findOne({ _id: meeting.createdBy.toString() });

      if (user.email === email) {
        // check if the person is the creator
        socket.join(meetingId);
        socket
          // .to(meetingId)
          // .broadcast
          .emit('meeting-creator-joined', { meetingId, email });
        return;
      }

      // check if the user is already a participant
      const isParticipant = meeting.participants.find((p) => p.email === email);

      if (!isParticipant) {
        // check if the user is in the waiting room
        const isWaiting = meeting.waitingRoom.find((p) => {
          return p.email === email;
        });

        const expectedMeetingMember = meeting.expectedParticipants.find((p) => {
          return p.email === email;
        });

        if (
          (!isWaiting && !expectedMeetingMember) ||
          (isWaiting === undefined && expectedMeetingMember === undefined)
        ) {
          return socket.emit('error', 'Not invited for the meeting');
        }

        if (isWaiting) {
          // notify the creator about the user in the waiting room
          socket.emit('user-waiting', {
            meetingId,
            email,
            waitingMembers: meeting.waitingRoom,
          });

          io.to(meeting.createdBy.toString()).emit('user-waiting', {
            email: email,
            socketId: socket.id,
            meetingId: meetingId,
            waitingMembers: meeting.waitingRoom,
          });
        } else if (expectedMeetingMember) {
          const updateResult = await Meeting.findOneAndUpdate(
            { meetingId, 'waitingRoom.email': { $ne: email } },
            {
              $push: { waitingRoom: expectedMeetingMember },
              $pull: { expectedParticipants: { email } },
            },
            { new: true }
          );

          if (updateResult) {
            socket.emit('user-waiting', {
              meetingId,
              email,
              waiting: meeting.waitingRoom,
            });

            io.to(meeting.createdBy.toString()).emit('user-waiting', {
              email: email,
              socketId: socket.id,
              meetingId: meetingId,
            });
          } else {
            socket.emit(
              'error',
              'Failed to update meeting information. This is to prevent multiple saves...'
            );
          }
          return;
        }
      } else {
        // join the user to the meeting
        socket.join(meetingId);
        socket.emit('already-joined', { meetingId, email });

        io.to(meetingId).emit('new-peer', {
          peerID: socket.id,
          email,
          participants: meeting.participants,
        });
      }

      socket.emit('all-users', { meetingId, users: meeting.waitingRoom });
      return;
    } catch (error) {
      console.log(error);
      socket.emit('error', error);
    }
  });

  socket.on('sending-signal', ({ userToCall, signalData }) => {
    console.log('ID', socket.handshake.query);
    console.log(payload);
    io.to(userToCall).emit('user-signal', {
      signal: signalData,
      callerID: payload.userUniqueId,
    });
  });

  socket.on('signal', async ({ signalData, meetingId }) => {
    console.log('Calling me');
    try {
      socket.broadcast.to(meetingId).emit('signal', signalData);
    } catch (error) {
      console.log(error);
      socket.emit('error', error);
    }
  });

  socket.on('approve-user', async (meetingId, email) => {
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return socket.emit('error', 'Meeting not found');
    } else {
      try {
        const userToPush = meeting.waitingRoom.find((p) => p.email === email);

        meeting.participants.push(userToPush);
        meeting.waitingRoom = meeting.waitingRoom.filter(
          (participant) => participant.email !== email
        );
        await meeting.save();
        io.to(socket.id).emit('user-approved', 'You have been approved', {
          meetingId,
          email,
        });
      } catch (error) {
        console.log('error', error);
        socket.emit('error', error);
      }
    }
  });

  socket.on('end-meeting', async ({ meetingId, email }) => {
    try {
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        return socket.emit('error', 'Meeting not found');
      }

      const user = await User.findOne({ email });

      if (user && user._id === meeting.createdBy.toString()) {
        await Meeting.deleteOne({ meetingId });
        io.to(meetingId).emit('meeting-ended', 'The meeting has ended');
      } else {
        return socket.emit(
          'error',
          'You are not authorized to end the meeting'
        );
      }
    } catch (error) {
      console.log('error', error);
      socket.emit('error', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected', socket.id);
  });
});

// setTimeout(async () => {
//   const meetingId = '00af1790-7f96-454f-9c04-851f59d5e54c';
//   const email = 'cryptoalert86@gmail.com';
//   const meeting = await Meeting.findOne({
//     meetingId: meetingId,
//   });

//   const returnUser = meeting.waitingRoom.find((p) => {
//     return (p.email = email);
//   });

//   meeting.expectedParticipants.push(returnUser);
//   meeting.waitingRoom = meeting.waitingRoom.filter((p) => {
//     return p.email !== email;
//   });
//   await meeting.save();
// }, 3000);

/**
 * NOTE
 * If you want the browser to send credentials such as cookies, authorization headers or TLS client certificates, you also need to set withCredentials option to true on the client side:
 */

export { io, httpServer, app };

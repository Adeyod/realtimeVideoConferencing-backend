import mongoose, { Schema } from 'mongoose';

const theParticipants = {
  email: { type: String, required: true },
  uniqueId: { type: String, required: true },
  uniqueMeetingLink: { type: String, required: true },
};

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  meetingId: { type: String, required: true, unique: true },
  meetingLink: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: Object }],
  expectedParticipants: [theParticipants],
  waitingRoom: [{ type: Object }],
  dateTime: { type: Date, required: true },
});

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;

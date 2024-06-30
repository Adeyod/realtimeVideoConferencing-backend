import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    userName: { type: String, required: true, unique: true },
    isVerified: { type: Boolean, required: true, default: false },
    password: { type: String, required: true },
    email: { type: String, required: true },
    image: {
      url: String,
      publicId: String,
      signature: String,
      assetId: String,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;

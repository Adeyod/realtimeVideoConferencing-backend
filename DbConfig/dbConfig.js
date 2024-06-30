import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const dbConnect = mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log(
      `MongoDB connected to database on ${mongoose.connection.host}`.bgMagenta
    );
  })
  .catch((error) => {
    console.log('MongoDB failed to connect to database.', error);
    process.exit(1);
  });

export default dbConnect;

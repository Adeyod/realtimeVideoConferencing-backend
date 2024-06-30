import express from 'express';
import colors from 'colors';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { io, app, httpServer } from './socket.js';
import dbConnect from './DbConfig/dbConfig.js';
import userRoute from './routes/userRoute.js';
import meetingRoute from './routes/meetingRoute.js';

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ['http://localhost:5174', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use([
  express.json(),
  express.urlencoded({ extended: true }),
  cookieParser(),
]);

app.use('/api/users', userRoute);
app.use('/api/v2', meetingRoute);

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`.america);
});

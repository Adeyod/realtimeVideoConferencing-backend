import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/userModel.js';

const authToken = async (res, user) => {
  try {
    const payload = {
      email: user.email,
      id: user.id,
    };

    const payload2 = {
      email: user.email,
      id: user.id,
      unique: uuidv4(),
    };

    const token = await jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '10d',
    });

    const frontendToken = await jwt.sign(payload2, process.env.JWT_SECRET, {
      expiresIn: '10d',
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      maxAge: 10 * 60 * 60 * 24 * 1000,
      secure: true,
    });

    return frontendToken;
  } catch (error) {
    console.log(error);
  }
};

const authUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token || token === null || token === undefined) {
      return res.json({
        error: 'Please login to continue',
        success: false,
        status: 401,
      });
    } else {
      const decodedToken = await jwt.decode(token);

      if (!decodedToken || !decodedToken.id) {
        return res.json({
          error: 'Invalid Token',
          success: false,
          status: 401,
        });
      }

      const user = await User.findOne({ _id: decodedToken.id }).select(
        '-password'
      );
      console.log('test:', req.user);

      req.user = user;

      next();
    }
  } catch (error) {
    console.log(error);
  }
};

export { authToken, authUser };

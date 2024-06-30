import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import User from '../models/userModel.js';
import {
  sendMessageToQueue,
  pollMessagesAndSend,
  deleteMessageFromQueue,
} from '../middlewares/awsSqs.js';
import {
  forgotPasswordMessage,
  verifyEmail,
} from '../middlewares/nodemailer.js';
import Token from '../models/tokenModel.js';
import { authToken } from '../middlewares/jwtAuth.js';
import { destroyImage, uploadImage } from '../middlewares/cloudinary.js';
import { setUncaughtExceptionCaptureCallback } from 'process';

const forbiddenCharsRegex = /[|!{}()&=[\]===><>]/;

const registerUser = async (req, res) => {
  try {
    const { userName, firstName, lastName, email, password, confirmPassword } =
      req.body;

    if (
      !userName ||
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.json({
        error: 'All fields are required',
        status: 400,
        success: false,
      });
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUserName = userName.trim();

    if (forbiddenCharsRegex.test(trimmedFirstName)) {
      return res.json({
        error: 'Forbidden characters in first name',
        status: 400,
        success: false,
      });
    }

    if (forbiddenCharsRegex.test(trimmedLastName)) {
      return res.json({
        error: 'Forbidden characters in last name',
        success: false,
        status: 400,
      });
    }

    if (forbiddenCharsRegex.test(trimmedUserName)) {
      return res.json({
        error: 'Forbidden characters in user name',
        success: false,
        status: 400,
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({
        error: 'Invalid email format',
        status: 400,
        success: false,
      });
    }

    if (
      !/^(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-])(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,20}$/.test(
        password
      )
    ) {
      return res.json({
        error:
          'Password must contain at least 1 lowercase, 1 uppercase, 1 special character. Minimum of 8 characters and maximum of 20 characters.',
        success: false,
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return res.json({
        error: 'Password and confirm password do not match.',
        status: 400,
        success: false,
      });
    }

    const emailExist = await User.findOne({
      $or: [
        {
          email: email,
        },
        { userName: { $regex: `^${trimmedUserName}$`, $options: 'i' } },
      ],
    });
    if (emailExist) {
      return res.json({
        error: 'Email or Username already exists',
        success: false,
        status: 400,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await new User({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      userName: trimmedUserName,
      password: hashedPassword,
      email,
    }).save();

    const token =
      crypto.randomBytes(32).toString('hex') +
      crypto.randomBytes(32).toString('hex');

    const newToken = await new Token({
      userId: newUser._id,
      token,
    }).save();

    const link = `${process.env.FRONTEND_URL}/email-verification?userId=${newToken.userId}&token=${newToken.token}`;

    // SENDING TO QUEUE USING AWS SQS
    // const emailSent = await sendMessageToQueue({
    //   email: newUser.email,
    //   firstName: newUser.firstName,
    //   link: link,
    //   userId: newUser._id,
    // });

    // if (emailSent && emailSent.$metadata.httpStatusCode === 200) {
    //   return res.json({
    //     message:
    //       'Registration successful. Please verify your email with the link sent to you.',
    //     success: true,
    //     status: 201,
    //   });
    // } else {
    //   console.log(emailSent);
    //   return;
    // }

    const emailSent = await verifyEmail({
      email: newUser.email,
      firstName: newUser.firstName,
      link,
    });

    if (emailSent.response && emailSent.accepted.length > 0) {
      return res.json({
        message:
          'Registration successful. Please verify your email with the link sent to you.',
        success: true,
        status: 201,
      });
    } else {
      console.log(emailSent);
      return;
    }
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const emailVerification = async (req, res) => {
  try {
    const { userId, token } = req.params;
    if (!userId || !token) {
      return res.json({
        error: 'Parameters not found',
        status: 404,
        success: false,
      });
    }

    const findToken = await Token.findOne({
      token,
      userId,
    });

    if (!findToken) {
      return res.json({
        error: 'Token not found',
        success: false,
        status: 404,
      });
    }

    const updateUser = await User.findByIdAndUpdate(
      {
        _id: userId,
      },
      {
        isVerified: true,
      },
      { new: true }
    );

    if (!updateUser) {
      return res.json({
        error: 'Unable to update user',
        success: false,
        status: 404,
      });
    } else {
      await findToken.deleteOne();

      return res.json({
        message: `${updateUser.firstName} your email has been updated successfully. You can now login`,
        status: 200,
        success: true,
      });
    }
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { userNameOrEmail, password } = req.body;

    const trimmedUserNameOrEmail = userNameOrEmail.trim();

    if (!userNameOrEmail || !password) {
      return res.json({
        error: 'All fields are required',
        status: 400,
        success: false,
      });
    }

    if (
      !/^(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-])(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,20}$/.test(
        password
      )
    ) {
      return res.json({
        error:
          'Password must include at least one uppercase, one lowercase letter, one special character. It must also be minimum of 8 characters and maximum of 20 characters',
        status: 400,
        success: false,
      });
    }

    let user;

    if (userNameOrEmail.includes('@')) {
      user = await User.findOne({ email: trimmedUserNameOrEmail }).select(
        '-password'
      );
    } else {
      user = await User.findOne({
        userName: { $regex: `^${trimmedUserNameOrEmail}$`, $options: 'i' },
      });
    }

    if (!user) {
      return res.json({
        error: 'Invalid credentials',
        status: 404,
        success: false,
      });
    }

    const confirmPassword = await bcrypt.compare(password, user.password);
    if (!confirmPassword) {
      return res.json({
        error: 'Invalid credentials',
        status: 400,
        success: false,
      });
    }

    if (user.isVerified !== true) {
      let checkToken;
      let link;
      checkToken = await Token.findOne({
        userId: user._id,
      });

      if (checkToken) {
        link = `${process.env.FRONTEND_URL}/email-verification?userId=${user._id}&token=${checkToken.token}`;
      } else {
        const token =
          crypto.randomBytes(32).toString('hex') +
          crypto.randomBytes(32).toString('hex');

        checkToken = await new Token({
          userId: user._id,
          token,
        }).save();

        link = `${process.env.FRONTEND_URL}/email-verification?userId=${checkToken.userId}&token=${checkToken.token}`;
      }

      // SENDING TO QUEUE USING AWS SQS
      // const emailSent = await sendMessageToQueue({
      //   email: user.email,
      // firstName: user.firstName,
      // link,
      // userId: checkToken.userId,
      // });

      // if (emailSent && emailSent.$metadata.httpStatusCode === 200) {
      //   return res.json({
      //    error: 'Please verify your email',
      // status: 400,
      // success: false
      //   });
      // } else {
      //   console.log(emailSent);
      //   return;
      // }

      await verifyEmail({
        email: user.email,
        firstName: user.firstName,
        link,
        userId: checkToken.userId,
      });

      return res.json({
        error: 'Please verify your email',
        status: 400,
        success: false,
      });
    } else {
      const generatedToken = await authToken(res, user);

      const { password, ...others } = user._doc;
      console.log(others);

      return res.json({
        message: `${others.userName} login successfully`,
        status: 200,
        success: true,
        user: others,
        token: generatedToken,
      });
    }
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    const userLogout = res.cookie('token', '', { maxAge: -1 });

    if (!userLogout) {
      return res.json({
        error: 'Unable to log user out',
        status: 400,
        success: false,
      });
    }

    return res.json({
      message: 'User logged out successfully',
      status: 200,
      success: true,
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

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.json({
        error: 'Please provide an email address',
        status: 400,
        success: false,
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.json({
        error: 'Invalid email address',
        status: 400,
        success: false,
      });
    }

    const emailExist = await User.findOne({ email });

    if (!emailExist) {
      return res.json({
        error: 'Email address not found',
        success: false,
        status: 404,
      });
    }

    const findToken = await Token.findOne({
      userId: emailExist._id,
    });

    let token;
    let link;

    if (findToken) {
      link = `${process.env.FRONTEND_URL}/reset-password?userId=${findToken.userId}&token=${findToken.token}`;
    } else {
      token =
        crypto.randomBytes(32).toString('hex') +
        crypto.randomBytes(32).toString('hex');

      const newToken = await new Token({
        userId: emailExist._id,
        token,
      }).save();

      link = `${process.env.FRONTEND_URL}/reset-password?userId=${newToken.userId}&token=${newToken.token}`;
    }

    // emailExist.email,
    //   emailExist.firstName,
    //   link,
    //   emailExist._id

    await forgotPasswordMessage(emailExist.email, emailExist.firstName, link);

    return res.json({
      message: `${emailExist.firstName}, Password reset link has been sent to your email address`,
      status: 200,
      success: true,
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

const allowResetPassword = async (req, res) => {
  try {
    const { userId, token } = req.params;

    const findToken = await Token.findOne({
      userId,
      token,
    });

    if (!findToken) {
      return res.json({
        error: 'Token not found',
        success: false,
        status: 404,
      });
    } else {
      return res.json({
        message: 'Token found. Allow user to change password',
        status: 200,
        success: true,
        userObject: {
          userId: userId,
          token: token,
        },
      });
    }
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { userId, token } = req.params;

    if (!password || !confirmPassword) {
      return res.json({
        error: 'All fields are required',
        status: 400,
        success: false,
      });
    }

    if (
      !/^(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-])(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,20}$/.test(
        password
      )
    ) {
      return res.json({
        error:
          'Password must contain at least one uppercase, one lowercase, one special character. It must be minimum of 8 characters and maximum of 20 characters',
        status: 400,
        success: false,
      });
    }

    if (password !== confirmPassword) {
      return res.json({
        error: 'Password and confirm password do not match',
        success: false,
        status: 400,
      });
    }

    const findToken = await Token.findOne({
      userId,
      token,
    });

    if (!findToken) {
      return res.json({
        error: 'Token does not exist',
        success: false,
        status: 400,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updateUser = await User.findByIdAndUpdate(
      { _id: findToken.userId },
      {
        password: hashedPassword,
      },
      { new: true }
    ).select('-password');

    if (!updateUser) {
      return res.json({
        error: 'Unable to change password',
        status: 400,
        success: false,
      });
    } else {
      await findToken.deleteOne();

      return res.json({
        message: 'Password changed successfully',
        success: true,
        status: 200,
        user: updateUser,
      });
    }
  } catch (error) {
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, userName } = req.body;
    const user = req.user;
    const findUser = await User.findOne({ _id: user._id }).select('-password');
    if (!findUser) {
      return res.json({
        error: 'User not found',
        success: false,
        status: 404,
      });
    }

    let image = req.file;

    if (!firstName || !lastName) {
      return res.json({
        error: 'All fields are required',
        status: 400,
        success: false,
      });
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUserName = userName.trim();

    if (firstName !== '') {
      if (forbiddenCharsRegex.test(trimmedFirstName)) {
        return res.json({
          error: 'Forbidden characters in field first name',
          status: 403,
          success: false,
        });
      }
    }

    if (lastName !== '') {
      if (forbiddenCharsRegex.test(trimmedLastName)) {
        return res.json({
          error: 'Forbidden characters in field last name',
          success: false,
          status: 403,
        });
      }
    }

    if (userName !== '') {
      if (forbiddenCharsRegex.test(trimmedUserName)) {
        return res.json({
          error: 'Forbidden characters in field user name',
          success: false,
          status: 403,
        });
      }
    }

    if (trimmedUserName !== findUser.userName) {
      const userNameExist = await User.findOne({
        userName: { $regex: `^${trimmedUserName}$`, $options: 'i' },
      });

      if (userNameExist) {
        return res.json({
          error: 'This username you want to change to has already being taken',
          success: false,
          status: 400,
        });
      }
    }

    if (image) {
      if (user.image.url) {
        const deletePreviousImage = await destroyImage(user.image.publicId);
        console.log(deletePreviousImage);
      }
      // upload image to cloudinary server and return it as object
      const uploadNewImage = await uploadImage(req, res);
      image = {
        url: uploadNewImage.url,
        publicId: uploadNewImage.publicId,
        assetId: uploadNewImage.assetId,
        signature: uploadNewImage.signature,
      };
    }

    console.log('image:', image);

    findUser.firstName = trimmedFirstName;
    findUser.lastName = trimmedLastName;
    findUser.email = email;
    findUser.userName = trimmedUserName;
    findUser.image = image?.url ? image : findUser.image;

    await findUser.save();

    console.log('findUser:', findUser);

    return res.json({
      message: 'User updated successfully',
      status: 200,
      success: true,
      user: findUser,
    });
  } catch (error) {
    console.log(error);
    return res.json({
      error: error.message,
      success: false,
      status: 500,
      message: 'Something happened',
    });
  }
};

// const registerUser = async(req, res)=>{
//   try {

//   } catch (error) {
//     return res.json({
//       error: error.message,
//       success: false,
//       status: 500,
//       message: 'Something happened'
//     })
//   }
// }

// setInterval(async () => {
//   const fetchMessages = await pollMessagesAndSend();

//   if (fetchMessages && fetchMessages !== undefined) {
//     const { Messages } = fetchMessages;

//     if (Messages && Messages.length > 0) {
//       Messages.map(async (message) => {
//         const { email, link, firstName, userId } = JSON.parse(message.Body);
//         console.log(email, link, firstName, userId);
//         const result = await verifyEmail({ email, firstName, link, userId });
//         if (result.response && result.accepted.length > 0) {
//           const response = await deleteMessageFromQueue(message.ReceiptHandle);
//           console.log('response: ', response);
//         } else {
//           console.log(result);
//         }
//       });
//     }
//   } else {
//     console.log('fetchMessages is undefined');
//   }
// }, 10000);

export {
  forgotPassword,
  logoutUser,
  emailVerification,
  loginUser,
  registerUser,
  resetPassword,
  allowResetPassword,
  updateProfile,
};

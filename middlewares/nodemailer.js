import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const transporter = nodemailer.createTransport({
  host: process.env.HOST,
  port: process.env.PORT,
  secure: process.env.SECURE,
  service: process.env.SERVICE,
  auth: {
    user: process.env.USER,
    pass: process.env.PASS,
  },
  tls: { rejectUnauthorized: false },
});

const verifyEmailTemplatePath = join(
  __dirname,
  'emailTemplates',
  'verifyEmail.html'
);

const meetingNotificationTemplatePath = join(
  __dirname,
  'emailTemplates',
  'meetingNotification.html'
);

const forgotPasswordTemplatePath = join(
  __dirname,
  'emailTemplates',
  'resetPassword.html'
);

const verifyEmailTemplate = readFileSync(verifyEmailTemplatePath, 'utf8');
const forgotPasswordTemplate = readFileSync(forgotPasswordTemplatePath, 'utf8');
const meetingNotificationTemplate = readFileSync(
  meetingNotificationTemplatePath,
  'utf8'
);

const verifyEmail = async ({ email, firstName, link }) => {
  const verifyEmailContent = verifyEmailTemplate
    .replace('{{link}}', link)
    .replace('{{firstName}}', firstName);
  try {
    const info = await transporter.sendMail({
      from: process.env.USER,
      to: email,
      subject: 'Email Verification',
      html: verifyEmailContent,
    });

    return info;
  } catch (error) {
    console.log(error);
  }
};

const forgotPasswordMessage = async (email, firstName, link) => {
  const forgotPasswordContent = forgotPasswordTemplate
    .replace('{{firstName}}', firstName)
    .replace('{{link}}', link);
  try {
    const info = await transporter.sendMail({
      from: process.env.USER,
      to: email,
      subject: 'Reset Password',
      html: forgotPasswordContent,
    });

    return info;
  } catch (error) {
    console.log(error);
  }
};

const meetingNotification = async ({
  title,
  email,
  date,
  creatorEmail,
  creatorName,
  link,
}) => {
  try {
    console.log(creatorName);
    const meetingNotificationContent = meetingNotificationTemplate
      .replace('{{title}}', title)
      .replace('{{date}}', date)
      .replace('{{link}}', link)
      .replace('{name}', creatorName)
      .replace('{{creatorEmail}}', creatorEmail)
      .replace('{creatorEmail}', creatorEmail);

    const info = await transporter.sendMail({
      from: creatorName,
      to: email,
      subject: 'Meeting notification',
      html: meetingNotificationContent,
    });

    return info;
  } catch (error) {
    console.log(error);
  }
};

export { verifyEmail, forgotPasswordMessage, meetingNotification };

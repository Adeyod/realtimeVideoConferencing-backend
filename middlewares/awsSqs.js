import {
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';
dotenv.config();

const region = process.env.AWS_REGION;
const accessKey = process.env.AWS_ACCESS_KEY_ID_SQS;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY_SQS;
const queueUrl = process.env.AWS_QUEUE_URL;

const client = new SQSClient({
  region: region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});

const sendMessageToQueue = async ({ email, firstName, link, userId }) => {
  try {
    console.log(
      'email: ' + email,
      'firstName:' + firstName,
      'link:' + link,
      'userId:' + userId
    );

    const body = {
      email,
      link,
      firstName,
      userId,
    };

    const message = JSON.stringify(body);

    const input = {
      QueueUrl: queueUrl,
      MessageBody: message,
      MessageAttributes: {
        messageId: { DataType: 'String', StringValue: userId },
      },
    };

    const command = new SendMessageCommand(input);

    const result = await client.send(command);
    console.log(result.$metadata.httpStatusCode);
    if (result.$metadata.httpStatusCode === 200) {
      console.log(result);
      return result;
    } else {
      console.log(result);
      return result;
    }
  } catch (error) {
    console.log(error.message);
  }
};

const pollMessagesAndSend = async () => {
  try {
    const input = {
      QueueUrl: queueUrl,
      MessageAttributeNames: ['All'],
      WaitTimeSeconds: 0,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 30,
    };

    const command = new ReceiveMessageCommand(input);
    const response = await client.send(command);
    const messages = response.Messages;
    if (messages && messages.length > 0) {
      // console.log(messages);
      return response;
    }
  } catch (error) {
    console.log(error.message);
  }
};

const deleteMessageFromQueue = async (ReceiptHandle) => {
  try {
    const input = {
      QueueUrl: queueUrl,
      ReceiptHandle: ReceiptHandle,
    };

    const command = new DeleteMessageCommand(input);
    const response = await client.send(command);

    return response;
  } catch (error) {
    console.log(error);
  }
};

export { sendMessageToQueue, pollMessagesAndSend, deleteMessageFromQueue };

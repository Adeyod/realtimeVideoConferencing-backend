import cloudinary from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryUploads = async (file, folder) => {
  return new Promise((resolve) => {
    cloudinary.uploader.upload(
      file,
      (result) => {
        resolve({
          url: result.url,
          assetId: result.asset_id,
          publicId: result.public_id,
          signature: result.signature,
        });
      },
      {
        resource_type: 'auto',
        folder: folder,
      }
    );
  });
};

const uploader = async (path) => {
  return await cloudinaryUploads(path, 'realtimeChatAndVideoConferencing');
};

const uploadSingleFile = async (file, res) => {
  const { path } = file;

  const newPath = await uploader(path);

  fs.unlinkSync(path);
  return newPath;
};

const uploadMultipleFiles = async (files, res) => {
  const urls = [];

  for (const file of files) {
    const { path } = file;
    try {
      const newPath = await uploader(path);
      urls.push(newPath);
      fs.unlinkSync(newPath);
    } catch (error) {
      console.log(error);
    }
  }

  return urls;
};

const uploadImage = async (req, res) => {
  try {
    let newPath;

    if (req.file) {
      newPath = await uploadSingleFile(req.file, res);
    }
    if (req.files && req.files.length > 1) {
      newPath = await uploadMultipleFiles(req.files, res);
    } else if (req.files && req.files.length === 1) {
      newPath = await uploadSingleFile(req.files[0], res);
    }

    // console.log(newPath);
    return newPath;
  } catch (error) {
    console.log(error);
  }
};

const destroyImage = async (public_id) => {
  const publicIdsArray = Array.isArray(public_id) ? public_id : [public_id];
  const deletePromise = publicIdsArray.map(async (publicId) => {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.log(error);
    }
  });
};

export { uploadImage, destroyImage };

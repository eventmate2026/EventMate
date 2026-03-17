import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default (file, options = {}) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    const folder = String(options?.folder || "eventmate/avatars").trim() || "eventmate/avatars";
    const resourceType = String(options?.resourceType || "image").trim() || "image";
    const format = options?.format;
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, ...(format ? { format } : {}) },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(file.buffer);
  });

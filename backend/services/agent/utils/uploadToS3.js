// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { s3 } from "../config/s3.js";

// export const uploadToS3 = async (filename, buffer, contentType) => {
//   await s3.send(
//     new PutObjectCommand({
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Body: buffer,
//       Key: filename,
//       ContentType: contentType,
//     }),
//   );
//   return filename
// };


import { saveFile } from "./localFiles.js";

// Same name and arguments as the S3 version, so the PDF, PPT and image agents
// keep working unchanged. The file is now saved on this server's disk.
// (contentType is not needed: it is derived from the extension when served.)
export const uploadToS3 = async (filename, buffer, contentType) => {
  // contentType is kept so S3 callers stay compatible; local serving uses the extension.
  void contentType;
  await saveFile(filename, buffer);
  return filename
};
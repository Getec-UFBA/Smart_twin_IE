import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';

// No Firebase Functions, o único diretório gravável é o os.tmpdir()
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.FUNCTION_NAME;

const rootTmp = isProduction ? os.tmpdir() : path.resolve(__dirname, '..', '..', 'tmp');

const tmpFolder = path.join(rootTmp, 'uploads');
const reviewsTempFolder = path.join(rootTmp, 'reviews');
const projectsUploadFolder = path.resolve(__dirname, '../../public/uploads/projects');
const avatarsUploadFolder = path.resolve(__dirname, '../../public/uploads/avatars');

if (!fs.existsSync(tmpFolder)) {
  fs.mkdirSync(tmpFolder, { recursive: true });
}
if (!fs.existsSync(reviewsTempFolder)) {
  fs.mkdirSync(reviewsTempFolder, { recursive: true });
}

export default {
  tempDirectory: tmpFolder,
  reviewsDirectory: reviewsTempFolder,
  projectsDirectory: projectsUploadFolder,
  avatarsDirectory: avatarsUploadFolder,
  storage: (directory: string) => multer.diskStorage({
    destination: directory,
    filename(request, file, callback) {
      const fileHash = crypto.randomBytes(10).toString('hex');
      const fileName = `${fileHash}-${file.originalname.replace(/\s/g, '_')}`;
      return callback(null, fileName);
    },
  }),
};

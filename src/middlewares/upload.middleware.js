import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const avatarDir = fileURLToPath(
  new URL("../../uploads/avatars", import.meta.url)
);
const maxAvatarFileSize = 2 * 1024 * 1024;

fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    if (!req.user?.id) {
      cb(new Error("Unauthorized"));
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${req.user.id}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
    return;
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxAvatarFileSize,
  },
}).single("avatar");

function uploadAvatar(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Avatar image must be 2 MB or smaller",
      });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(error.message === "Unauthorized" ? 401 : 400).json({
      success: false,
      message: error.message || "Invalid avatar upload",
    });
  });
}

export default uploadAvatar;
export { avatarDir, maxAvatarFileSize };

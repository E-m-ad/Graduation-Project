import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const productImagesDir = fileURLToPath(
  new URL("../../uploads/products", import.meta.url),
);
const maxProductImageFileSize = 5 * 1024 * 1024;
const maxProductImageCount = 10;

fs.mkdirSync(productImagesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productImagesDir);
  },
  filename: (req, file, cb) => {
    if (!req.user?.id) {
      cb(new Error("Unauthorized"));
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${req.user.id}-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${ext}`;
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
    fileSize: maxProductImageFileSize,
    files: maxProductImageCount,
  },
}).array("images", maxProductImageCount);

function uploadProductImages(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each product image must be 5 MB or smaller",
      });
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: `You can upload up to ${maxProductImageCount} images at a time`,
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
      message: error.message || "Invalid product image upload",
    });
  });
}

export default uploadProductImages;
export { maxProductImageCount, maxProductImageFileSize, productImagesDir };

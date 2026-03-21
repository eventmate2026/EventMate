import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  }
});

const eventUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for event resources
  },
  fileFilter: (req, file, cb) => {
    const isPoster = file.fieldname === "poster";
    const isResource = file.fieldname === "resourceFile";
    const isPaymentQr = file.fieldname === "paymentQr";
    const isImage = file.mimetype.startsWith("image/");
    const isPdf = file.mimetype === "application/pdf";

    if (isPoster && !isImage) {
      cb(new Error("Event poster must be an image file"), false);
      return;
    }

    if (isPaymentQr && !isImage) {
      cb(new Error("Payment QR must be an image file"), false);
      return;
    }

    if (isResource && !(isImage || isPdf)) {
      cb(new Error("Resource file must be a PNG, JPG, or PDF"), false);
      return;
    }

    if (!isPoster && !isResource && !isPaymentQr) {
      cb(new Error("Unexpected file field"), false);
      return;
    }

    cb(null, true);
  }
});

export { eventUpload };
export default upload;

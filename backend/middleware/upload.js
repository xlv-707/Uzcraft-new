const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Upload directory
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        // Images
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml',
        // Documents
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Archives
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        // Audio
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac',
        // Video
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.mimetype.split('/')[0];
        const subDir = path.join(uploadDir, type);
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }
        cb(null, subDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, safeName + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

module.exports = upload;

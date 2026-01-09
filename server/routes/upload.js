const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 }, // 500KB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed (jpg, png, gif, webp)'));
        }
    }
});

// Upload image endpoint
router.post('/', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload base64 image (for paste)
router.post('/base64', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image data' });
        }

        // Extract base64 data
        const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const ext = matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');

        // Check size
        if (buffer.length > 500 * 1024) {
            return res.status(400).json({ error: 'Image too large (max 500KB)' });
        }

        // Save file
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        fs.writeFileSync(path.join(uploadsDir, filename), buffer);

        res.json({
            success: true,
            url: `/uploads/${filename}`,
            filename
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handler for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 500KB)' });
        }
    }
    res.status(500).json({ error: error.message });
});

module.exports = router;

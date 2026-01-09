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
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
        const ext = path.extname(file.originalname);
        // Read source from query params (more reliable than body with multer)
        const source = req.query.source || 'upload';
        const keepName = req.query.keepName === 'true';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // If keepName is true (from media page), use original name with upload- prefix
        if (keepName) {
            let baseName = path.basename(file.originalname, ext);
            let filename = `upload-${baseName}${ext}`;
            // Handle duplicates
            let counter = 1;
            while (fs.existsSync(path.join(uploadsDir, filename))) {
                filename = `upload-${baseName}_${counter}${ext}`;
                counter++;
            }
            cb(null, filename);
        } else {
            // Use source prefix
            const prefix = ['editor', 'logo'].includes(source) ? source : 'upload';
            cb(null, `${prefix}-${uniqueSuffix}${ext}`);
        }
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
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

// Upload base64 image (for paste in editor)
router.post('/base64', express.json({ limit: '1mb' }), (req, res) => {
    try {
        const { image, source } = req.body;
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

        // Save file with source prefix
        const prefix = ['editor', 'logo'].includes(source) ? source : 'editor';
        const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
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

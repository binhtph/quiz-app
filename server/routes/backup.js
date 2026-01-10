const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Multer config for ZIP upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    }
});

// GET /api/backup/export - Export all exams & uploads as ZIP
router.get('/export', (req, res) => {
    try {
        // Get all exams
        const exams = db.prepare('SELECT * FROM exams').all();

        // Get all questions
        const questions = db.prepare('SELECT * FROM questions ORDER BY exam_id, order_num').all();

        // Create data object
        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exams,
            questions
        };

        // Set response headers for ZIP download
        const filename = `quiz-backup-${new Date().toISOString().split('T')[0]}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).json({ error: 'Failed to create backup' });
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add data.json
        archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

        // Add uploads directory if exists
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                const filePath = path.join(uploadsDir, file);
                if (fs.statSync(filePath).isFile()) {
                    archive.file(filePath, { name: `uploads/${file}` });
                }
            }
        }

        // Finalize archive
        archive.finalize();

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/backup/import - Import ZIP backup (overwrites existing data)
router.post('/import', upload.single('backup'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Extract ZIP from buffer
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();

        // Find and parse data.json
        const dataEntry = entries.find(e => e.entryName === 'data.json');
        if (!dataEntry) {
            return res.status(400).json({ error: 'Invalid backup: data.json not found' });
        }

        const data = JSON.parse(dataEntry.getData().toString('utf8'));

        // Validate structure
        if (!data.exams || !data.questions) {
            return res.status(400).json({ error: 'Invalid backup: missing exams or questions' });
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Delete existing exams and questions (cascades)
            db.prepare('DELETE FROM questions').run();
            db.prepare('DELETE FROM exams').run();

            // Reset auto-increment
            db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('exams', 'questions')").run();

            // Import exams with original IDs
            const insertExam = db.prepare(`
                INSERT INTO exams (id, title, description, time_limit, learn_mode, logo, pin_code, created_at, shuffle_questions, shuffle_answers) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const exam of data.exams) {
                insertExam.run(
                    exam.id,
                    exam.title,
                    exam.description,
                    exam.time_limit || 30,
                    exam.learn_mode || 0,
                    exam.logo,
                    exam.pin_code,
                    exam.created_at,
                    exam.shuffle_questions || 0,
                    exam.shuffle_answers || 0
                );
            }

            // Import questions with original IDs
            const insertQuestion = db.prepare(`
                INSERT INTO questions (id, exam_id, type, question, options, correct_answer, notes, order_num)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const q of data.questions) {
                insertQuestion.run(
                    q.id,
                    q.exam_id,
                    q.type,
                    q.question,
                    q.options,
                    q.correct_answer,
                    q.notes,
                    q.order_num || 0
                );
            }
        });

        transaction();

        // Clear uploads directory
        if (fs.existsSync(uploadsDir)) {
            const existingFiles = fs.readdirSync(uploadsDir);
            for (const file of existingFiles) {
                fs.unlinkSync(path.join(uploadsDir, file));
            }
        } else {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Extract uploads from ZIP
        for (const entry of entries) {
            if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
                const filename = path.basename(entry.entryName);
                const targetPath = path.join(uploadsDir, filename);
                fs.writeFileSync(targetPath, entry.getData());
            }
        }

        res.json({
            success: true,
            imported: {
                exams: data.exams.length,
                questions: data.questions.length,
                files: entries.filter(e => e.entryName.startsWith('uploads/')).length
            }
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../database');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Get all media files with usage info
router.get('/', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOADS_DIR).filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
        });

        // Get all questions to check usage
        const questions = db.prepare(`
            SELECT q.id, q.question, q.notes, q.exam_id, e.title as exam_title
            FROM questions q
            JOIN exams e ON q.exam_id = e.id
        `).all();

        // Get all exams to check logo usage
        const exams = db.prepare(`SELECT id, title, logo FROM exams`).all();

        // Build unique exams list for filter dropdown
        const examMap = new Map();
        exams.forEach(e => examMap.set(e.id, e.title));

        const mediaList = files.map(name => {
            const filePath = path.join(UPLOADS_DIR, name);
            const stats = fs.statSync(filePath);

            // Find where this file is used
            const usedIn = [];
            const searchPattern = `/uploads/${name}`;

            // Check in questions
            questions.forEach(q => {
                const inQuestion = q.question && q.question.includes(searchPattern);
                const inNotes = q.notes && q.notes.includes(searchPattern);

                if (inQuestion || inNotes) {
                    usedIn.push({
                        questionId: q.id,
                        examId: q.exam_id,
                        examTitle: q.exam_title,
                        type: 'question',
                        question: q.question ? q.question.substring(0, 50) + '...' : ''
                    });
                }
            });

            // Check in exam logos
            exams.forEach(e => {
                if (e.logo && e.logo.includes(searchPattern)) {
                    usedIn.push({
                        examId: e.id,
                        examTitle: e.title,
                        type: 'logo'
                    });
                }
            });

            return {
                name,
                size: stats.size,
                createdAt: stats.birthtime,
                usedIn
            };
        });

        // Sort by creation date (newest first)
        mediaList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Get unique exam IDs from usedIn
        const usedExamIds = new Set();
        mediaList.forEach(m => {
            m.usedIn.forEach(u => usedExamIds.add(u.examId));
        });

        const examList = Array.from(usedExamIds).map(id => ({
            id,
            title: examMap.get(id) || 'Unknown'
        }));

        res.json({ files: mediaList, exams: examList });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rename a file
router.post('/rename', (req, res) => {
    try {
        const { oldName, newName } = req.body;

        if (!oldName || !newName) {
            return res.status(400).json({ error: 'Missing oldName or newName' });
        }

        // Security: prevent path traversal
        const sanitizedOld = path.basename(oldName);
        const sanitizedNew = path.basename(newName);

        const oldPath = path.join(UPLOADS_DIR, sanitizedOld);
        const newPath = path.join(UPLOADS_DIR, sanitizedNew);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ error: 'A file with this name already exists' });
        }

        // Rename the file
        fs.renameSync(oldPath, newPath);

        // Update references in database
        const oldPattern = `/uploads/${sanitizedOld}`;
        const newPattern = `/uploads/${sanitizedNew}`;

        // Update questions
        db.prepare(`
            UPDATE questions 
            SET question = REPLACE(question, ?, ?),
                notes = REPLACE(notes, ?, ?)
        `).run(oldPattern, newPattern, oldPattern, newPattern);

        // Update exam logos
        db.prepare(`
            UPDATE exams 
            SET logo = REPLACE(logo, ?, ?)
        `).run(oldPattern, newPattern);

        res.json({ success: true, newName: sanitizedNew });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a file
router.delete('/:name', (req, res) => {
    try {
        const name = path.basename(req.params.name);
        const filePath = path.join(UPLOADS_DIR, name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all exams
router.get('/', (req, res) => {
    try {
        const exams = db.prepare(`
      SELECT e.*, COUNT(q.id) as question_count 
      FROM exams e 
      LEFT JOIN questions q ON e.id = q.exam_id 
      GROUP BY e.id 
      ORDER BY e.created_at DESC
    `).all();

        // Get top scores grouped by user (max score, count attempts)
        const getTopScores = db.prepare(`
      SELECT user_name, 
             MAX(score) as score, 
             total, 
             MIN(time_taken) as time_taken,
             COUNT(*) as attempts
      FROM results 
      WHERE exam_id = ? AND user_name IS NOT NULL
      GROUP BY user_name
      ORDER BY score DESC, time_taken ASC 
      LIMIT 3
    `);

        const result = exams.map(exam => ({
            ...exam,
            top_scores: getTopScores.all(exam.id)
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single exam
router.get('/:id', (req, res) => {
    try {
        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }
        // Don't expose PIN code in normal get
        delete exam.pin_code;
        res.json(exam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify PIN code
router.post('/:id/verify-pin', (req, res) => {
    try {
        const { pin } = req.body;
        const exam = db.prepare('SELECT pin_code FROM exams WHERE id = ?').get(req.params.id);

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        // If no PIN set, allow access
        if (!exam.pin_code) {
            return res.json({ success: true, pin_code: null });
        }

        if (exam.pin_code === pin) {
            res.json({ success: true, pin_code: exam.pin_code });
        } else {
            res.status(401).json({ success: false, error: 'Invalid PIN' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create exam
router.post('/', (req, res) => {
    try {
        const { title, description, time_limit, learn_mode, logo, pin_code } = req.body;

        // Default PIN is 1234 if not provided
        const pin = pin_code || '1234';

        const result = db.prepare(
            'INSERT INTO exams (title, description, time_limit, learn_mode, logo, pin_code) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(title, description || '', time_limit || 30, learn_mode ? 1 : 0, logo || null, pin);

        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(exam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update exam
// Update exam (Support partial updates)
router.put('/:id', (req, res) => {
    try {
        const { title, description, time_limit, learn_mode, logo, pin_code, shuffle_questions, shuffle_answers } = req.body;

        const updates = [];
        const values = [];

        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (time_limit !== undefined) { updates.push('time_limit = ?'); values.push(time_limit); }
        if (learn_mode !== undefined) { updates.push('learn_mode = ?'); values.push(learn_mode ? 1 : 0); }
        if (logo !== undefined) { updates.push('logo = ?'); values.push(logo); }
        if (pin_code !== undefined) { updates.push('pin_code = ?'); values.push(pin_code); }
        if (shuffle_questions !== undefined) { updates.push('shuffle_questions = ?'); values.push(shuffle_questions ? 1 : 0); }
        if (shuffle_answers !== undefined) { updates.push('shuffle_answers = ?'); values.push(shuffle_answers ? 1 : 0); }

        if (updates.length > 0) {
            const sql = `UPDATE exams SET ${updates.join(', ')} WHERE id = ?`;
            values.push(req.params.id);
            db.prepare(sql).run(...values);
        }

        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
        res.json(exam);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete exam (requires PIN)
router.delete('/:id', (req, res) => {
    try {
        const { pin } = req.body;
        const exam = db.prepare('SELECT pin_code FROM exams WHERE id = ?').get(req.params.id);

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        // Verify PIN if exam has one
        if (exam.pin_code && exam.pin_code !== pin) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get exam questions (for taking exam)
router.get('/:id/questions', (req, res) => {
    try {
        const exam = db.prepare('SELECT learn_mode FROM exams WHERE id = ?').get(req.params.id);
        const questions = db.prepare(
            'SELECT id, exam_id, type, question, options, notes, correct_answer, order_num FROM questions WHERE exam_id = ? ORDER BY order_num'
        ).all(req.params.id);

        // Check if learn mode from exam setting OR from URL query param
        const learnModeFromUrl = req.query.learn === '1';
        const isLearnMode = (exam && exam.learn_mode) || learnModeFromUrl;

        res.json(questions.map(q => {
            const parsed = {
                ...q,
                options: JSON.parse(q.options || '[]')
            };
            // Include correct_answer for learn mode
            if (isLearnMode) {
                parsed.correct_answer = ['drag_drop', 'matching', 'multiple_choice'].includes(q.type)
                    ? JSON.parse(q.correct_answer)
                    : q.correct_answer;
            }
            return parsed;
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get exam questions with answers (for editor)
router.get('/:id/questions/edit', (req, res) => {
    try {
        const questions = db.prepare(
            'SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num'
        ).all(req.params.id);

        res.json(questions.map(q => ({
            ...q,
            options: JSON.parse(q.options || '[]'),
            correct_answer: ['drag_drop', 'matching', 'multiple_choice'].includes(q.type)
                ? JSON.parse(q.correct_answer)
                : q.correct_answer
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get leaderboard (grouped by user with best score)
router.get('/:id/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const results = db.prepare(`
      SELECT user_name, 
             MAX(score) as score, 
             total, 
             MIN(time_taken) as time_taken,
             COUNT(*) as attempts,
             ROUND(MAX(score) * 100.0 / total, 1) as percentage
      FROM results 
      WHERE exam_id = ? AND user_name IS NOT NULL
      GROUP BY user_name
      ORDER BY score DESC, time_taken ASC 
      LIMIT ?
    `).all(req.params.id, limit);

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user history for an exam
router.get('/:id/history/:userName', (req, res) => {
    try {
        const userName = decodeURIComponent(req.params.userName);
        const results = db.prepare(`
      SELECT score, total, time_taken, completed_at,
             ROUND(score * 100.0 / total, 1) as percentage
      FROM results 
      WHERE exam_id = ? AND user_name = ?
      ORDER BY completed_at DESC
    `).all(req.params.id, userName);

        res.json({
            user_name: userName,
            total_attempts: results.length,
            best_score: results.length > 0 ? Math.max(...results.map(r => r.score)) : 0,
            history: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user name in all results
router.post('/update-name', (req, res) => {
    try {
        const { old_name, new_name } = req.body;

        if (!old_name || !new_name) {
            return res.status(400).json({ error: 'Both old_name and new_name are required' });
        }

        const result = db.prepare(
            'UPDATE results SET user_name = ? WHERE user_name = ?'
        ).run(new_name, old_name);

        res.json({
            success: true,
            updated_count: result.changes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit exam and get score
router.post('/:id/submit', (req, res) => {
    try {
        const { answers, time_taken, user_name } = req.body;
        const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
        const questions = db.prepare(
            'SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num'
        ).all(req.params.id);

        let score = 0;
        const results = [];

        questions.forEach(q => {
            const userAnswer = answers[q.id];
            let isCorrect = false;

            if (q.type === 'single_choice') {
                isCorrect = userAnswer === q.correct_answer;
            } else if (q.type === 'multiple_choice') {
                const correctArr = JSON.parse(q.correct_answer);
                if (Array.isArray(userAnswer) && Array.isArray(correctArr)) {
                    const sortedUser = [...userAnswer].sort();
                    const sortedCorrect = [...correctArr].sort();
                    isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
                }
            } else if (q.type === 'drag_drop') {
                const correctOrder = JSON.parse(q.correct_answer);
                isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctOrder);
            } else if (q.type === 'matching') {
                const correctPairs = JSON.parse(q.correct_answer);
                // Compare each key-value pair instead of entire object stringify
                if (userAnswer && typeof userAnswer === 'object') {
                    const correctKeys = Object.keys(correctPairs);
                    isCorrect = correctKeys.length > 0 &&
                        correctKeys.every(key => userAnswer[key] === correctPairs[key]);
                }
            }

            if (isCorrect) score++;

            results.push({
                question_id: q.id,
                question: q.question,
                type: q.type,
                options: JSON.parse(q.options || '[]'),
                user_answer: userAnswer,
                correct_answer: ['drag_drop', 'matching', 'multiple_choice'].includes(q.type)
                    ? JSON.parse(q.correct_answer)
                    : q.correct_answer,
                is_correct: isCorrect,
                notes: q.notes
            });
        });

        // Check for new record before saving
        const currentRecord = db.prepare(`
      SELECT MAX(score) as max_score, MIN(time_taken) as min_time
      FROM results 
      WHERE exam_id = ? AND score = (SELECT MAX(score) FROM results WHERE exam_id = ?)
    `).get(req.params.id, req.params.id);

        const isNewRecord = !currentRecord.max_score ||
            score > currentRecord.max_score ||
            (score === currentRecord.max_score && time_taken < currentRecord.min_time);

        // Save result
        db.prepare(
            'INSERT INTO results (exam_id, user_name, score, total, answers, time_taken) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(req.params.id, user_name || null, score, questions.length, JSON.stringify(answers), time_taken || 0);

        // Broadcast record if new
        if (isNewRecord && user_name && score > 0) {
            const broadcastRecord = req.app.get('broadcastRecord');
            if (broadcastRecord) {
                broadcastRecord({
                    type: 'new_record',
                    exam_id: req.params.id,
                    exam_title: exam.title,
                    user_name,
                    score,
                    total: questions.length,
                    percentage: Math.round((score / questions.length) * 100),
                    time_taken
                });
            }
        }

        res.json({
            score,
            total: questions.length,
            percentage: questions.length > 0 ? Math.round((score / questions.length) * 100) : 0,
            results,
            is_new_record: isNewRecord && user_name && score > 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete all questions in an exam
router.delete('/:id/questions', (req, res) => {
    try {
        db.prepare('DELETE FROM questions WHERE exam_id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all history for a user across all exams
router.get('/history/user/:userName', (req, res) => {
    try {
        const userName = decodeURIComponent(req.params.userName);
        const results = db.prepare(`
            SELECT r.*, e.title as exam_title,
                   ROUND(r.score * 100.0 / r.total, 1) as percentage
            FROM results r
            JOIN exams e ON r.exam_id = e.id
            WHERE r.user_name = ?
            ORDER BY r.completed_at DESC
        `).all(userName);

        res.json({
            user_name: userName,
            history: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

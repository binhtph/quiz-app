const express = require('express');
const router = express.Router();
const db = require('../database');

// Create question
router.post('/', (req, res) => {
    try {
        const { exam_id, type, question, options, correct_answer, notes, order_num } = req.body;

        const result = db.prepare(
            'INSERT INTO questions (exam_id, type, question, options, correct_answer, notes, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
            exam_id,
            type,
            question,
            JSON.stringify(options),
            ['drag_drop', 'matching', 'multiple_choice'].includes(type) ? JSON.stringify(correct_answer) : correct_answer,
            notes || null,
            order_num || 0
        );

        const newQuestion = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({
            ...newQuestion,
            options: JSON.parse(newQuestion.options || '[]'),
            correct_answer: ['drag_drop', 'matching', 'multiple_choice'].includes(type)
                ? JSON.parse(newQuestion.correct_answer)
                : newQuestion.correct_answer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update question
router.put('/:id', (req, res) => {
    try {
        const { type, question, options, correct_answer, notes, order_num } = req.body;

        db.prepare(
            'UPDATE questions SET type = ?, question = ?, options = ?, correct_answer = ?, notes = ?, order_num = ? WHERE id = ?'
        ).run(
            type,
            question,
            JSON.stringify(options),
            ['drag_drop', 'matching', 'multiple_choice'].includes(type) ? JSON.stringify(correct_answer) : correct_answer,
            notes || null,
            order_num,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
        res.json({
            ...updated,
            options: JSON.parse(updated.options || '[]'),
            correct_answer: ['drag_drop', 'matching', 'multiple_choice'].includes(type)
                ? JSON.parse(updated.correct_answer)
                : updated.correct_answer
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete question
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder questions
router.post('/reorder', (req, res) => {
    try {
        const { orders } = req.body;

        const update = db.prepare('UPDATE questions SET order_num = ? WHERE id = ?');
        const updateMany = db.transaction((orders) => {
            for (const item of orders) {
                update.run(item.order_num, item.id);
            }
        });

        updateMany(orders);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'quiz.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    time_limit INTEGER DEFAULT 30,
    learn_mode INTEGER DEFAULT 0,
    logo TEXT,
    pin_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('single_choice', 'multiple_choice', 'drag_drop', 'matching')),
    question TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT NOT NULL,
    notes TEXT,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    user_name TEXT,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers TEXT,
    time_taken INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );
`);

// Migration for existing DBs
try { db.exec('ALTER TABLE questions ADD COLUMN notes TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE exams ADD COLUMN learn_mode INTEGER DEFAULT 0'); } catch (e) { }
try { db.exec('ALTER TABLE exams ADD COLUMN logo TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE exams ADD COLUMN pin_code TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE results ADD COLUMN user_name TEXT'); } catch (e) { }
try { db.exec('ALTER TABLE exams ADD COLUMN shuffle_questions INTEGER DEFAULT 0'); } catch (e) { }
try { db.exec('ALTER TABLE exams ADD COLUMN shuffle_answers INTEGER DEFAULT 0'); } catch (e) { }

// Insert sample data if empty
const examCount = db.prepare('SELECT COUNT(*) as count FROM exams').get();
if (examCount.count === 0) {
  const insertExam = db.prepare('INSERT INTO exams (title, description, time_limit, pin_code) VALUES (?, ?, ?, ?)');
  const insertQuestion = db.prepare('INSERT INTO questions (exam_id, type, question, options, correct_answer, notes, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)');

  // Sample exam with PIN
  const result = insertExam.run('Sample Quiz', 'A sample quiz to test the application', 10, '1234');
  const examId = result.lastInsertRowid;

  // Sample questions
  insertQuestion.run(examId, 'single_choice', 'What is the capital of France?',
    JSON.stringify(['London', 'Paris', 'Berlin', 'Madrid']), 'Paris', 'Paris is the capital and largest city of France.', 1);

  insertQuestion.run(examId, 'multiple_choice', 'Which of the following are programming languages?',
    JSON.stringify(['Python', 'HTML', 'JavaScript', 'Photoshop']),
    JSON.stringify(['Python', 'JavaScript']), 'Python and JavaScript are programming languages. HTML is a markup language.', 2);

  insertQuestion.run(examId, 'single_choice', 'What is 2 + 2?',
    JSON.stringify(['3', '4', '5', '6']), '4', null, 3);

  insertQuestion.run(examId, 'drag_drop', 'Arrange in order: smallest to largest',
    JSON.stringify(['Elephant', 'Mouse', 'Cat', 'Dog']),
    JSON.stringify(['Mouse', 'Cat', 'Dog', 'Elephant']), null, 4);

  insertQuestion.run(examId, 'matching', 'Match the countries with their capitals',
    JSON.stringify({ left: ['France', 'Germany', 'Japan'], right: ['Paris', 'Berlin', 'Tokyo'] }),
    JSON.stringify({ 'France': 'Paris', 'Germany': 'Berlin', 'Japan': 'Tokyo' }), 'Capital cities quiz!', 5);
}

// Create uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

module.exports = db;

const API_URL = '/api';
const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('id');
const learnModeParam = urlParams.get('learn');
const userNameParam = urlParams.get('user');

let exam = null;
let questions = [];
let currentIndex = 0;
let answers = {};
let markedQuestions = new Set();
let timeRemaining = 0;
let timerInterval = null;
let startTime = null;
let learnMode = false;
let feedbackShown = {};
let matchingSelection = null;
let showMarkedOnly = false;

// ===== Initialize =====
async function init() {
    if (!examId) {
        window.location.href = '/';
        return;
    }

    try {
        // Load exam info
        const examRes = await fetch(`${API_URL}/exams/${examId}`);
        exam = await examRes.json();

        // Load questions
        const questionsRes = await fetch(`${API_URL}/exams/${examId}/questions?learn=1`);
        questions = await questionsRes.json();

        if (questions.length === 0) {
            alert('Exam này chưa có câu hỏi!');
            window.location.href = '/';
            return;
        }

        // Setup Start Screen
        document.getElementById('start-title').textContent = exam.title;
        document.getElementById('start-desc').textContent = exam.description || 'Không có mô tả';

        // Defaults from URL
        const learnUrl = urlParams.get('learn');
        const shuffleQUrl = urlParams.get('sq');
        const shuffleAUrl = urlParams.get('sa');

        const isLearn = learnUrl === '1';
        const isShuffleQ = shuffleQUrl === '1';
        const isShuffleA = shuffleAUrl === '1';

        const elLearn = document.getElementById('opt-learn-mode');
        const elShuffleQ = document.getElementById('opt-shuffle-q');
        const elShuffleA = document.getElementById('opt-shuffle-a');

        if (elLearn) elLearn.checked = isLearn;
        if (elShuffleQ) elShuffleQ.checked = isShuffleQ;
        if (elShuffleA) elShuffleA.checked = isShuffleA;

        document.getElementById('start-screen').classList.add('active');

    } catch (error) {
        console.error(error);
        alert('Không thể tải bài thi. Vui lòng thử lại.');
        window.location.href = '/';
    }
}

function startExamSession() {
    // Read options
    const elLearn = document.getElementById('opt-learn-mode');
    const elShuffleQ = document.getElementById('opt-shuffle-q');
    const elShuffleA = document.getElementById('opt-shuffle-a');

    learnMode = elLearn ? elLearn.checked : false;
    const shuffleQ = elShuffleQ ? elShuffleQ.checked : false;
    const shuffleA = elShuffleA ? elShuffleA.checked : false;

    // Apply Shuffle
    if (shuffleQ) {
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }
    }

    if (shuffleA) {
        questions.forEach(q => {
            if (q.type === 'single_choice' || q.type === 'multiple_choice') {
                if (q.options) {
                    for (let i = q.options.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
                    }
                }
            }
        });
    }

    // Matching always requires shuffling
    questions.forEach(q => {
        if (q.type === 'matching' && q.options && q.options.right) {
            q.shuffledRight = [...q.options.right];
            for (let i = q.shuffledRight.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [q.shuffledRight[i], q.shuffledRight[j]] = [q.shuffledRight[j], q.shuffledRight[i]];
            }
        }
    });

    // Setup timer
    timeRemaining = (exam.time_limit || 30) * 60;
    startTime = Date.now();
    startTimer();

    // Show learn mode indicator
    if (learnMode) {
        const header = document.querySelector('.exam-header');
        if (header) {
            header.insertAdjacentHTML('afterbegin', '<span class="learn-mode-badge" style="margin-right:1rem;">📚 Learn Mode</span>');
        }
    }

    // Hide start screen
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.remove('active');

    // Render navigation and question
    renderNav();
    showQuestion(0);
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Hết giờ! Bài thi sẽ được nộp tự động.');
            submitExam();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const el = document.getElementById('timer-display');
    if (el) el.textContent = display;

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.classList.remove('warning', 'danger');
        if (timeRemaining <= 60) timerEl.classList.add('danger');
        else if (timeRemaining <= 300) timerEl.classList.add('warning');
    }
}

function renderNav() {
    const nav = document.getElementById('question-nav');
    if (!nav) return;

    const markedCount = markedQuestions.size;
    let markedFilterHtml = '';
    if (markedCount > 0) {
        markedFilterHtml = `
            <div class="marked-filter">
                🚩 ${markedCount} câu đánh dấu
                <button onclick="toggleMarkedFilter()">${showMarkedOnly ? 'Xem tất cả' : 'Xem câu đánh dấu'}</button>
            </div>
        `;
    }

    const questionsToShow = showMarkedOnly
        ? questions.filter((q, i) => markedQuestions.has(i))
        : questions;

    nav.innerHTML = markedFilterHtml + questionsToShow.map((q) => {
        const realIndex = questions.indexOf(q);
        return `
            <div class="question-nav-item${realIndex === currentIndex ? ' active' : ''}${markedQuestions.has(realIndex) ? ' marked' : ''}${answers[q.id] !== undefined ? ' answered' : ''}"
                data-index="${realIndex}"
                onclick="showQuestion(${realIndex})">
                ${realIndex + 1}
            </div>
        `;
    }).join('');
}

function toggleMarkedFilter() {
    showMarkedOnly = !showMarkedOnly;
    renderNav();
}

function updateNav() {
    const items = document.querySelectorAll('.question-nav-item');
    items.forEach((item) => {
        const idx = parseInt(item.getAttribute('data-index'));
        item.classList.remove('active', 'answered', 'marked');
        if (idx === currentIndex) item.classList.add('active');
        if (answers[questions[idx].id] !== undefined) item.classList.add('answered');
        if (markedQuestions.has(idx)) item.classList.add('marked');
    });

    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / questions.length) * 100;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${progress}%`;
}

function showQuestion(index) {
    currentIndex = index;
    const question = questions[index];
    const card = document.getElementById('question-card');
    if (!card) return;
    const hasFeedback = feedbackShown[question.id];

    let questionContent = '';
    if (question.type === 'single_choice') questionContent = renderSingleChoice(question, hasFeedback);
    else if (question.type === 'multiple_choice') questionContent = renderMultipleChoice(question, hasFeedback);
    else if (question.type === 'drag_drop') questionContent = renderDragDrop(question);
    else if (question.type === 'matching') questionContent = renderMatching(question, hasFeedback);

    card.innerHTML = `
        <div class="question-header">
            <h2>Câu ${index + 1} / ${questions.length}</h2>
            <button class="mark-btn ${markedQuestions.has(index) ? 'marked' : ''}" onclick="toggleMark()">
                🚩 ${markedQuestions.has(index) ? 'Bỏ đánh dấu' : 'Đánh dấu'}
            </button>
        </div>
        <div class="question-text">${escapeHtml(question.question)}</div>
        ${questionContent}
        ${hasFeedback ? renderLearnFeedback(question) : ''}
        <div class="question-footer">
            <button class="btn btn-secondary" ${index === 0 ? 'disabled' : ''} onclick="prevQuestion()">
                ← Câu trước
            </button>
            <button class="btn btn-primary" onclick="handleNext()">
                ${index === questions.length - 1 ? 'Hoàn thành' : 'Câu sau →'}
            </button>
        </div>
    `;

    updateNav();
    if (question.type === 'drag_drop') setupDragDrop();
}

function renderSingleChoice(question, showFeedback) {
    const selectedAnswer = answers[question.id];
    const correctAnswer = question.correct_answer;
    return `
        <div class="options-list">
            ${(question.options || []).map((option) => {
        let classes = 'option-item';
        if (selectedAnswer === option) classes += ' selected';
        if (showFeedback && learnMode) {
            if (option === correctAnswer) classes += ' correct-answer';
            else if (selectedAnswer === option) classes += ' wrong-answer';
        }
        const disabled = showFeedback && learnMode ? 'style="pointer-events: none;"' : '';
        return `
                    <div class="${classes}" ${disabled} onclick="selectSingleOption(${question.id}, '${escapeHtml(option).replace(/'/g, "\\'")}')">
                        <div class="option-radio"></div>
                        <span>${escapeHtml(option)}</span>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderMultipleChoice(question, showFeedback) {
    const selectedAnswers = answers[question.id] || [];
    const correctAnswers = question.correct_answer || [];
    return `
        <p class="text-muted mb-2">Chọn tất cả đáp án đúng:</p>
        <div class="options-list">
            ${(question.options || []).map((option) => {
        const isSelected = selectedAnswers.includes(option);
        const isCorrect = correctAnswers.includes(option);
        let classes = 'option-item';
        if (isSelected) classes += ' selected';
        if (showFeedback && learnMode) {
            if (isCorrect) classes += ' correct-answer';
            else if (isSelected) classes += ' wrong-answer';
        }
        const disabled = showFeedback && learnMode ? 'style="pointer-events: none;"' : '';
        return `
                    <div class="${classes}" ${disabled} onclick="toggleMultipleOption(${question.id}, '${escapeHtml(option).replace(/'/g, "\\'")}')">
                        <div class="option-checkbox">${isSelected ? '✓' : ''}</div>
                        <span>${escapeHtml(option)}</span>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderDragDrop(question) {
    let currentOrder = answers[question.id];
    if (!currentOrder) {
        currentOrder = [...(question.options || [])].sort(() => Math.random() - 0.5);
        answers[question.id] = currentOrder;
    }
    return `
        <p class="text-muted mb-2">Kéo để sắp xếp thứ tự đúng:</p>
        <div id="drag-container" class="drag-drop-container">
            ${currentOrder.map((option, i) => `
                <div class="drag-item" draggable="true" data-value="${escapeHtml(option)}">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="drag-number">${i + 1}</span>
                    <span>${escapeHtml(option)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderMatching(question, showFeedback) {
    const opts = question.options || { left: [], right: [] };
    const leftItems = opts.left || [];
    const userMatches = answers[question.id] || {};
    const correctMatches = question.correct_answer || {};
    let shuffledRight = question.shuffledRight || opts.right || [];

    return `
        <p class="text-muted mb-2">Click vào ô trái, sau đó click ô phải để ghép cặp:</p>
        <div class="matching-container">
            <div class="matching-column">
                <h4>Mục cần ghép</h4>
                <div class="matching-items" id="matching-left">
                    ${leftItems.map(item => {
        const isMatched = userMatches[item] !== undefined;
        let classes = 'matching-item left-item';
        if (matchingSelection === item) classes += ' selected';
        if (isMatched) classes += ' matched';
        if (showFeedback && isMatched) {
            if (userMatches[item] !== correctMatches[item]) classes = classes.replace('matched', 'wrong-answer');
        }
        return `
                            <div class="${classes}" onclick="selectLeftItem('${escapeHtml(item).replace(/'/g, "\\'")}')">
                                ${escapeHtml(item)}
                                ${isMatched ? `<span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted)">→ ${escapeHtml(userMatches[item])}</span>` : ''}
                            </div>
                        `;
    }).join('')}
                </div>
            </div>
            <div class="matching-column">
                <h4>Đáp án</h4>
                <div class="matching-items" id="matching-right">
                    ${shuffledRight.map(item => {
        const isUsed = Object.values(userMatches).includes(item);
        return `<div class="matching-item right-item ${isUsed ? 'matched' : ''}" onclick="selectRightItem('${escapeHtml(item).replace(/'/g, "\\'")}')">${escapeHtml(item)}</div>`;
    }).join('')}
                </div>
            </div>
        </div>
        ${showFeedback ? renderMatchingFeedback(question, userMatches) : ''}
    `;
}

function renderMatchingFeedback(question, userMatches) {
    let corect = question.correct_answer || {};
    if (typeof corect === 'string') try { corect = JSON.parse(corect); } catch (e) { corect = {}; }
    const results = Object.entries(corect).map(([left, right]) => ({
        left, correct: right, user: userMatches[left], isCorrect: userMatches[left] === right
    }));
    return `
        <div class="learn-feedback ${results.every(r => r.isCorrect) ? 'correct' : 'incorrect'}" style="margin-top:1rem;">
            <div class="learn-feedback-header">${results.every(r => r.isCorrect) ? '✅ Chính xác!' : '❌ Chưa đúng'}</div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                ${results.map(r => `
                    <div class="matching-pair ${r.isCorrect ? 'correct' : 'incorrect'}">
                        <span class="left">${escapeHtml(r.left)}</span><span class="arrow">→</span><span class="right">${escapeHtml(r.correct)}</span>
                        ${!r.isCorrect ? `<span style="color:var(--danger);font-size:0.8rem;">(Bạn: ${r.user || 'chưa chọn'})</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLearnFeedback(question) {
    if (!learnMode) return '';
    const userAnswer = answers[question.id];
    let isCorrect = false, correctDisplay = '';
    if (question.type === 'single_choice') {
        isCorrect = userAnswer === question.correct_answer;
        correctDisplay = question.correct_answer;
    } else if (question.type === 'multiple_choice') {
        const c = question.correct_answer || [], u = userAnswer || [];
        isCorrect = JSON.stringify([...u].sort()) === JSON.stringify([...c].sort());
        correctDisplay = c.join(', ');
    } else if (question.type === 'drag_drop') {
        isCorrect = JSON.stringify(userAnswer) === JSON.stringify(question.correct_answer);
        correctDisplay = (question.correct_answer || []).join(' → ');
    } else return '';

    return `
        <div class="learn-feedback ${isCorrect ? 'correct' : 'incorrect'}">
            <div class="learn-feedback-header">${isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng'}</div>
            ${!isCorrect ? `<div class="learn-feedback-answer"><strong>Đáp án đúng:</strong> ${escapeHtml(correctDisplay)}</div>` : ''}
            ${question.notes ? `<div class="learn-feedback-notes"><strong>📝 Ghi chú:</strong> ${escapeHtml(question.notes)}</div>` : ''}
        </div>
    `;
}

function selectLeftItem(val) {
    if (feedbackShown[questions[currentIndex].id]) return;
    const ans = answers[questions[currentIndex].id] || {};
    if (ans[val]) delete ans[val];
    else matchingSelection = val;
    answers[questions[currentIndex].id] = ans;
    showQuestion(currentIndex);
}

function selectRightItem(val) {
    if (feedbackShown[questions[currentIndex].id] || !matchingSelection) return;
    const ans = answers[questions[currentIndex].id] || {};
    Object.keys(ans).forEach(k => { if (ans[k] === val) delete ans[k]; });
    ans[matchingSelection] = val;
    answers[questions[currentIndex].id] = ans;
    matchingSelection = null;
    showQuestion(currentIndex);
}

function selectSingleOption(id, opt) {
    if (feedbackShown[id]) return;
    answers[id] = opt;
    showQuestion(currentIndex);
}

function toggleMultipleOption(id, opt) {
    if (feedbackShown[id]) return;
    let s = answers[id] || [];
    if (s.includes(opt)) s = s.filter(o => o !== opt);
    else s.push(opt);
    answers[id] = s.length ? s : undefined;
    showQuestion(currentIndex);
}

function toggleMark() {
    if (markedQuestions.has(currentIndex)) markedQuestions.delete(currentIndex);
    else markedQuestions.add(currentIndex);
    showQuestion(currentIndex);
}

function handleNext() {
    const q = questions[currentIndex];
    if (learnMode && !feedbackShown[q.id]) {
        let ok = false;
        const ans = answers[q.id];
        if (q.type === 'single_choice') ok = ans === q.correct_answer;
        else if (q.type === 'multiple_choice') ok = JSON.stringify([...(ans || [])].sort()) === JSON.stringify([...(q.correct_answer || [])].sort());
        else if (q.type === 'drag_drop') ok = JSON.stringify(ans) === JSON.stringify(q.correct_answer);
        else if (q.type === 'matching') {
            const m = ans || {}, c = q.correct_answer || {};
            ok = Object.keys(c).every(k => m[k] === c[k]);
        }
        if (!ok || !ans) { feedbackShown[q.id] = true; showQuestion(currentIndex); return; }
    }
    if (currentIndex === questions.length - 1) submitExam();
    else showQuestion(currentIndex + 1);
}

function prevQuestion() { if (currentIndex > 0) showQuestion(currentIndex - 1); }

function setupDragDrop() {
    const container = document.getElementById('drag-container');
    if (!container) return;
    let dragged = null;
    container.querySelectorAll('.drag-item').forEach(item => {
        item.ondragstart = (e) => { dragged = item; item.classList.add('dragging'); };
        item.ondragend = () => { item.classList.remove('dragging'); updateDragOrder(); };
        item.ondragover = (e) => e.preventDefault();
        item.ondrop = (e) => {
            if (item !== dragged) {
                const items = [...container.children];
                if (items.indexOf(dragged) < items.indexOf(item)) item.after(dragged);
                else item.before(dragged);
            }
        };
    });
}

function updateDragOrder() {
    const items = [...document.querySelectorAll('.drag-item')];
    answers[questions[currentIndex].id] = items.map(i => i.dataset.value);
    items.forEach((i, idx) => { i.querySelector('.drag-number').textContent = idx + 1; });
    updateNav();
}

async function submitExam() {
    clearInterval(timerInterval);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    try {
        const res = await fetch(`${API_URL}/exams/${examId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, time_taken: timeTaken, user_name: userNameParam ? decodeURIComponent(userNameParam) : null })
        });
        const result = await res.json();
        sessionStorage.setItem('examResult', JSON.stringify({ ...result, examTitle: exam.title, timeTaken, markedQuestionIds: questions.filter((q, i) => markedQuestions.has(i)).map(q => q.id) }));
        window.location.href = '/result.html';
    } catch (e) { alert('Lỗi nộp bài'); }
}

function escapeHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);

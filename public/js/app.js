const API_URL = '/api';

// ===== Toast Notification =====
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Allow HTML in message for newlines
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message).replace(/\n/g, '<br>')}</span>
    `;

    container.appendChild(toast);

    // Start fade out before removing
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let viewMode = localStorage.getItem('viewMode') || 'grid';
let currentExamId = null;
let currentPinCallback = null;
let currentLogoUrl = null;
let deleteExamId = null;

// SSE is now handled by ticker.js

// ===== Welcome Footer =====
function updateWelcomeName() {
    const savedName = localStorage.getItem('userName');
    const displayEl = document.getElementById('user-display-name');
    if (displayEl) {
        displayEl.textContent = savedName || 'Chưa đặt tên';
    }
}

function openFooterAction() {
    const savedName = localStorage.getItem('userName') || 'Bạn';
    showGlobalHistory(savedName);
}

async function showGlobalHistory(userName) {
    try {
        const response = await fetch(`${API_URL}/exams/history/user/${encodeURIComponent(userName)}`);
        const data = await response.json();

        const modal = document.getElementById('history-modal');
        const content = document.getElementById('history-content');

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin:0; display: flex; align-items: center; gap: 0.5rem;">
                    📊 Lịch sử thi của 
                    <input type="text" id="inline-name-input" value="${escapeHtml(userName)}" 
                           style="border: 1px solid transparent; background: transparent; font-size: inherit; font-weight: inherit; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); min-width: 100px; max-width: 200px;"
                           onblur="saveInlineName(this)"
                           onkeydown="if(event.key==='Enter'){this.blur();}"
                           onfocus="this.style.borderColor='var(--primary)'; this.style.background='var(--bg-secondary)';"
                           title="Click để đổi tên">
                </h3>
            </div>
            <div class="history-list">
                ${data.history.length === 0 ? '<p class="text-muted">Bạn chưa hoàn thành bài thi nào.</p>' :
                data.history.map((h, i) => {
                    // DB stores UTC string "YYYY-MM-DD HH:MM:SS", convert to "YYYY-MM-DDTHH:MM:SSZ"
                    const dateRaw = h.completed_at.replace(' ', 'T') + 'Z';
                    const date = new Date(dateRaw);
                    const dateStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const minutes = Math.floor(h.time_taken / 60);
                    const seconds = h.time_taken % 60;
                    return `
                            <div class="history-item">
                                <div style="flex: 1">
                                    <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem;">${escapeHtml(h.exam_title)}</div>
                                    <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted);">
                                        <span>🏁 ${h.score}/${h.total} (${h.percentage}%)</span>
                                        <span>⏱️ ${minutes}:${String(seconds).padStart(2, '0')}</span>
                                        <span>📅 ${dateStr}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                }).join('')
            }
            </div>
        `;
        modal.classList.add('active');
    } catch (error) {
        showToast('Không thể tải lịch sử. Vui lòng thử lại.', 'error');
    }
}

async function saveInlineName(input) {
    input.style.borderColor = 'transparent';
    input.style.background = 'transparent';

    const newName = input.value.trim();
    const oldName = localStorage.getItem('userName');

    if (!newName) {
        input.value = oldName || '';
        return;
    }

    if (oldName && oldName !== newName) {
        try {
            await fetch(`${API_URL}/exams/update-name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_name: oldName, new_name: newName })
            });
            loadExams();
        } catch (error) {
            console.error('Failed to update name in history:', error);
        }
    }

    localStorage.setItem('userName', newName);
    updateWelcomeName();
}

// ===== View Toggle =====
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('viewMode', mode);

    document.getElementById('grid-view-btn').classList.toggle('active', mode === 'grid');
    document.getElementById('list-view-btn').classList.toggle('active', mode === 'list');

    const grid = document.getElementById('exam-grid');
    grid.classList.toggle('exam-list', mode === 'list');
    grid.classList.toggle('exam-grid', mode === 'grid');
}

// ===== Exam Grid =====
async function loadExams() {
    const grid = document.getElementById('exam-grid');
    setViewMode(viewMode);

    try {
        const response = await fetch(`${API_URL}/exams`);
        const exams = await response.json();

        if (exams.length === 0) {
            grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3>Chưa có Exam nào</h3>
          <p>Bắt đầu bằng cách tạo exam đầu tiên của bạn</p>
        </div>
      `;
            return;
        }

        grid.innerHTML = exams.map(exam => `
      <div class="card exam-card" data-exam-id="${exam.id}">
        <div class="exam-card-header">
          ${exam.logo ? `<img src="${exam.logo}" class="exam-logo" alt="Logo">` : ''}
          <div class="exam-card-info">
            <h3>${escapeHtml(exam.title)}</h3>
            <p>${escapeHtml(exam.description || 'Không có mô tả')}</p>
          </div>
        </div>
        <div class="exam-meta">
          <span>⏱️ ${exam.time_limit} phút</span>
          <span>📋 ${exam.question_count} câu hỏi</span>
          ${exam.learn_mode ? '<span class="learn-mode-badge">📚 Learn</span>' : ''}
        </div>
        ${exam.top_scores && exam.top_scores.length > 0 ? `
          <div class="exam-leaderboard">
            <div class="leaderboard-title">🏆 Top điểm cao</div>
            ${exam.top_scores.slice(0, 3).map((s, i) => `
              <div class="leaderboard-item" onclick="showUserHistory(${exam.id}, '${escapeHtml(s.user_name).replace(/'/g, "\\'")}')">
                <span class="rank">${['🥇', '🥈', '🥉'][i]}</span>
                <span class="name">${escapeHtml(s.user_name)}${s.attempts > 1 ? `<span class="attempts">(${s.attempts})</span>` : ''}</span>
                <span class="score">${s.score}/${s.total}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="exam-actions">
          <button class="btn btn-primary btn-sm" onclick="openStartExamModal(${exam.id}, ${exam.learn_mode || 0})">Bắt đầu thi</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditor(${exam.id})">Chỉnh sửa</button>
          <button class="btn btn-icon" onclick="openDeleteModal(${exam.id})" title="Xóa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
    } catch (error) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1">
      <p>Không thể tải danh sách exam. Vui lòng thử lại.</p>
    </div>`;
    }
}

async function showUserHistory(examId, userName) {
    try {
        const response = await fetch(`${API_URL}/exams/${examId}/history/${encodeURIComponent(userName)}`);
        const data = await response.json();

        const modal = document.getElementById('history-modal');
        const content = document.getElementById('history-content');

        content.innerHTML = `
      <h3>📊 Lịch sử thi của ${escapeHtml(data.user_name)}</h3>
      <p class="text-muted">Tổng số lần thi: <strong>${data.total_attempts}</strong> | Điểm cao nhất: <strong>${data.best_score}</strong></p>
      <div class="history-list">
        ${data.history.map((h, i) => {
            // DB stores UTC string "YYYY-MM-DD HH:MM:SS", convert to "YYYY-MM-DDTHH:MM:SSZ"
            const dateRaw = h.completed_at.replace(' ', 'T') + 'Z';
            const date = new Date(dateRaw);
            const dateStr = date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const minutes = Math.floor(h.time_taken / 60);
            const seconds = h.time_taken % 60;
            return `
            <div class="history-item ${h.score === data.best_score ? 'best' : ''}">
              <span class="history-num">#${data.total_attempts - i}</span>
              <span class="history-score">${h.score}/${h.total} (${h.percentage}%)</span>
              <span class="history-time">⏱️ ${minutes}:${String(seconds).padStart(2, '0')}</span>
              <span class="history-date">${dateStr}</span>
              ${h.score === data.best_score ? '<span class="history-best">🏆</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

        modal.classList.add('active');
    } catch (error) {
        alert('Không thể tải lịch sử. Vui lòng thử lại.');
    }
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('active');
}

// ===== Delete Exam with PIN =====
function openDeleteModal(examId) {
    deleteExamId = examId;
    document.getElementById('delete-pin-input').value = '';
    document.getElementById('delete-error').classList.add('hidden');
    document.getElementById('delete-modal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.remove('active');
    deleteExamId = null;
}

async function confirmDelete() {
    const pin = document.getElementById('delete-pin-input').value;

    try {
        const response = await fetch(`${API_URL}/exams/${deleteExamId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeDeleteModal();
            loadExams();
        } else {
            document.getElementById('delete-error').textContent = data.error || 'Mã PIN không đúng!';
            document.getElementById('delete-error').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('delete-error').textContent = 'Có lỗi xảy ra!';
        document.getElementById('delete-error').classList.remove('hidden');
    }
}

// ===== Start Exam Modal =====
function openStartExamModal(examId, defaultLearnMode) {
    currentExamId = examId;
    document.getElementById('start-learn-mode').checked = defaultLearnMode === 1;

    const savedName = localStorage.getItem('userName');
    if (savedName) {
        document.getElementById('user-name').value = savedName;
    }

    document.getElementById('start-exam-modal').classList.add('active');
}

function closeStartExamModal() {
    document.getElementById('start-exam-modal').classList.remove('active');
    currentExamId = null;
}

function startExam() {
    const userName = document.getElementById('user-name').value.trim();
    if (!userName) {
        showToast('Vui lòng nhập tên của bạn!', 'error');
        return;
    }

    localStorage.setItem('userName', userName);

    const learnMode = document.getElementById('start-learn-mode').checked ? 1 : 0;
    const shuffleQ = document.getElementById('start-shuffle-q').checked ? 1 : 0;
    const shuffleA = document.getElementById('start-shuffle-a').checked ? 1 : 0;

    window.location.href = `/exam.html?id=${currentExamId}&learn=${learnMode}&sq=${shuffleQ}&sa=${shuffleA}&user=${encodeURIComponent(userName)}`;
}

function toggleNote(noteId, checkbox) {
    const note = document.getElementById(noteId);
    if (note) {
        note.classList.toggle('hidden', !checkbox.checked);
    }
}

function toggleLearnModeNote(checkbox) {
    toggleNote('learn-mode-note', checkbox);
}

// ===== PIN Modal =====
function openEditor(examId) {
    currentExamId = examId;

    fetch(`${API_URL}/exams/${examId}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '' })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                window.location.href = `/editor.html?id=${examId}`;
            } else {
                document.getElementById('pin-input').value = '';
                document.getElementById('pin-error').classList.add('hidden');
                document.getElementById('pin-modal').classList.add('active');
            }
        })
        .catch(() => {
            window.location.href = `/editor.html?id=${examId}`;
        });
}

function closePinModal() {
    document.getElementById('pin-modal').classList.remove('active');
    currentExamId = null;
}

async function verifyPin() {
    const pin = document.getElementById('pin-input').value;
    const examId = currentExamId; // Save before closePinModal resets it

    try {
        const response = await fetch(`${API_URL}/exams/${examId}/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });

        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem(`pin_${examId}`, pin);
            closePinModal();
            window.location.href = `/editor.html?id=${examId}`;
        } else {
            document.getElementById('pin-error').textContent = 'Mã PIN không đúng!';
            document.getElementById('pin-error').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('pin-error').textContent = 'Có lỗi xảy ra!';
        document.getElementById('pin-error').classList.remove('hidden');
    }
}

// ===== Create/Edit Exam Modal =====
function openCreateExamModal() {
    document.getElementById('modal-title').textContent = 'Tạo Exam Mới';
    document.getElementById('exam-form').reset();
    document.getElementById('exam-id').value = '';
    // Shuffle options removed
    currentLogoUrl = null;
    document.getElementById('logo-preview').innerHTML = '<span>📷 Click để chọn logo</span>';
    document.getElementById('exam-modal').classList.add('active');
}

function closeExamModal() {
    document.getElementById('exam-modal').classList.remove('active');
}

async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
        showToast('Hình ảnh quá lớn (tối đa 500KB)', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            currentLogoUrl = data.url;
            document.getElementById('logo-preview').innerHTML = `<img src="${data.url}" alt="Logo">`;
        } else {
            alert(data.error || 'Upload thất bại');
        }
    } catch (error) {
        alert('Không thể upload hình. Vui lòng thử lại.');
    }
}

async function saveExam(event) {
    event.preventDefault();

    const id = document.getElementById('exam-id').value;
    const data = {
        title: document.getElementById('exam-title').value,
        description: document.getElementById('exam-description').value,
        time_limit: parseInt(document.getElementById('exam-time').value) || 30,
        // shuffle options are removed from creation
        logo: currentLogoUrl
    };

    try {
        const url = id ? `${API_URL}/exams/${id}` : `${API_URL}/exams`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();

            if (!id && result.pin_code) {
                showToast(`Exam đã tạo!\nMã PIN mặc định: ${result.pin_code}`, 'success', 5000);
            } else if (!id) {
                showToast('Tạo Exam thành công!', 'success');
            } else {
                showToast('Cập nhật Exam thành công!', 'success');
            }

            closeExamModal();
            loadExams();
        }
    } catch (error) {
        showToast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    }
}

// ===== Utilities =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modals on overlay click
document.getElementById('exam-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeExamModal();
});

document.getElementById('start-exam-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeStartExamModal();
});

document.getElementById('pin-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closePinModal();
});

document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeDeleteModal();
});

document.getElementById('history-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeHistoryModal();
});

// PIN input - auto submit on 4 digits
document.getElementById('pin-input')?.addEventListener('input', (e) => {
    if (e.target.value.length === 4) verifyPin();
});

document.getElementById('delete-pin-input')?.addEventListener('input', (e) => {
    if (e.target.value.length === 4) confirmDelete();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadExams();
    updateWelcomeName();
});

const API_URL = '/api';
const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('id');

let exam = null;
let questions = [];
let selectedQuestionId = null;
let currentLogoUrl = null;

// ===== Initialize =====
async function init() {
  if (!examId) {
    window.location.href = '/';
    return;
  }

  await loadExam();
  await loadQuestions();
}

async function loadExam() {
  try {
    const response = await fetch(`${API_URL}/exams/${examId}`);
    exam = await response.json();

    document.getElementById('exam-info').innerHTML = `
      <div class="flex justify-between items-center column-gap-4">
        <div>
          <h2>${escapeHtml(exam.title)}</h2>
          <p class="text-muted">${escapeHtml(exam.description || 'Không có mô tả')}</p>
        </div>
        <div class="flex flex-col gap-2 items-end">
          <div class="flex gap-1 items-center">
            <span class="text-muted">⏱️ ${exam.time_limit} phút</span>
            <button class="btn btn-secondary btn-sm" onclick="editExam()">Sửa</button>
          </div>
        </div>
      </div>
    `;

    // Setup global paste handler for images
    setupPasteHandler();
  } catch (error) {
    alert('Không thể tải thông tin exam.');
  }
}

// ... (previous content)

function editExam() {
  try {
    const elTitle = document.getElementById('edit-exam-title');
    if (!elTitle) {
      console.error('Edit modal not found');
      alert('Lỗi: Không tìm thấy khung chỉnh sửa.');
      return;
    }
    elTitle.value = exam.title;
    document.getElementById('edit-exam-desc').value = exam.description || '';
    document.getElementById('edit-exam-time').value = exam.time_limit || 30;
    document.getElementById('edit-exam-pin').value = '';

    currentLogoUrl = exam.logo || null;
    const preview = document.getElementById('edit-logo-preview');
    if (preview) {
      preview.innerHTML = currentLogoUrl
        ? `<img src="${currentLogoUrl}" alt="Logo">`
        : '<span>📷 Click để chọn logo</span>';
    }

    const modal = document.getElementById('edit-exam-modal');
    if (modal) modal.classList.add('active');
  } catch (e) {
    console.error('Error opening edit modal:', e);
    alert('Có lỗi khi mở phần chỉnh sửa: ' + e.message);
  }
}

function closeEditExamModal() {
  document.getElementById('edit-exam-modal').classList.remove('active');
}

async function updateExamDetails(event) {
  event.preventDefault();

  const data = {
    title: document.getElementById('edit-exam-title').value,
    description: document.getElementById('edit-exam-desc').value,
    time_limit: parseInt(document.getElementById('edit-exam-time').value) || 30,
    logo: currentLogoUrl
  };

  const pin = document.getElementById('edit-exam-pin').value;
  if (pin.trim()) {
    data.pin_code = pin.trim();
  }

  try {
    const response = await fetch(`${API_URL}/exams/${examId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      closeEditExamModal();
      loadExam(); // Reload info
    } else {
      alert('Cập nhật thất bại.');
    }
  } catch (e) {
    console.error(e);
    alert('Lỗi cập nhật.');
  }
}

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    alert('Hình ảnh quá lớn (tối đa 500KB)');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`${API_URL}/upload?source=logo`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (data.success) {
      currentLogoUrl = data.url;
      document.getElementById('edit-logo-preview').innerHTML = `<img src="${data.url}" alt="Logo">`;
    } else {
      alert(data.error || 'Upload thất bại');
    }
  } catch (error) {
    alert('Không thể upload hình. Vui lòng thử lại.');
  }
}

async function updateExamSetting(key, value) {
  try {
    const data = { [key]: value };
    await fetch(`${API_URL}/exams/${examId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) { console.error('Failed to update setting', e); }
}

// ===== Import Logic =====
function openImportModal() {
  document.getElementById('import-text').value = '';
  document.getElementById('import-modal').classList.add('active');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('active');
}

async function processImport() {
  const text = document.getElementById('import-text').value;
  const shouldClear = document.getElementById('import-clear-old').checked;

  if (!text.trim()) return;

  const questionsData = parseImportText(text);
  if (questionsData.length === 0) {
    alert('Không tìm thấy câu hỏi nào hợp lệ!');
    return;
  }

  const msg = shouldClear
    ? `CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ ${questions.length} câu hỏi cũ và nhập ${questionsData.length} câu hỏi mới.\nBạn có chắc chắn không?`
    : `Tìm thấy ${questionsData.length} câu hỏi. Bạn có muốn nhập thêm vào không?`;

  if (!confirm(msg)) return;

  // Clear old questions if requested
  if (shouldClear) {
    try {
      await fetch(`${API_URL}/exams/${examId}/questions`, { method: 'DELETE' });
    } catch (e) {
      console.error("Failed to delete questions", e);
      alert("Lỗi khi xóa câu hỏi cũ!");
      return;
    }
  }

  // Process sequentially
  let successCount = 0;
  for (const q of questionsData) {
    try {
      await fetch(`${API_URL}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...q, exam_id: examId })
      });
      successCount++;
    } catch (e) {
      console.error('Import failed for question', q, e);
    }
  }

  alert(`Đã nhập thành công ${successCount}/${questionsData.length} câu hỏi.`);
  closeImportModal();
  loadQuestions();
}

// ===== Export Logic =====
function openExportModal() {
  const text = generateExamText(questions);
  const json = JSON.stringify({ exam, questions }, null, 2);

  document.getElementById('export-text').value = text;
  document.getElementById('export-json').value = json;

  switchExportTab('text');
  document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
}

function switchExportTab(tab) {
  const btnText = document.querySelector('button[onclick="switchExportTab(\'text\')"]');
  const btnJson = document.querySelector('button[onclick="switchExportTab(\'json\')"]');
  const divText = document.getElementById('export-tab-text');
  const divJson = document.getElementById('export-tab-json');
  const btnCopy = document.getElementById('btn-copy-export');
  const btnDownload = document.getElementById('btn-download-json');

  if (tab === 'text') {
    btnText.classList.add('active');
    btnJson.classList.remove('active');
    divText.classList.remove('hidden');
    divJson.classList.add('hidden');
    btnCopy.style.display = 'inline-block';
    btnDownload.style.display = 'none';
    btnCopy.textContent = 'Sao chép Text';
    btnCopy.setAttribute('onclick', 'copyExport()');
  } else {
    btnText.classList.remove('active');
    btnJson.classList.add('active');
    divText.classList.add('hidden');
    divJson.classList.remove('hidden');
    btnCopy.style.display = 'none';
    btnDownload.style.display = 'inline-block';
  }
}

function copyExport() {
  const text = document.getElementById('export-text');
  text.select();
  document.execCommand('copy');
  showToast('Đã sao chép vào clipboard!', 'success');
}

function downloadJSON() {
  const text = document.getElementById('export-json').value;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `exam_${examId}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateExamText(questions) {
  return questions.map((q, i) => {
    let optionsStr = '';

    if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      const isMulti = q.type === 'multiple_choice';
      let correctList = isMulti ? (q.correct_answer || []) : [q.correct_answer];

      optionsStr = (q.options || []).map((opt, idx) => {
        const char = String.fromCharCode(97 + idx); // a, b, c...
        const isCorrect = correctList.includes(opt);
        return `${isCorrect ? char.toUpperCase() : char.toLowerCase()}. ${opt}`;
      }).join('\n');
    } else if (q.type === 'drag_drop') {
      // Options are items.
      optionsStr = (q.options || []).map(opt => `- ${opt}`).join('\n');
    } else if (q.type === 'matching') {
      // correct_answer is { "Left": "Right" }
      const correct = q.correct_answer || {};
      if (correct) {
        optionsStr = Object.entries(correct).map(([l, r]) => `- ${l} -> ${r}`).join('\n');
      }
    }

    let header = `${i + 1}. ${q.question}`;
    if (q.type === 'drag_drop') header = `${i + 1}. [Order] ${q.question}`;
    if (q.type === 'matching') header = `${i + 1}. [Match] ${q.question}`;

    return `${header}\n${optionsStr}`;
  }).join('\n\n');
}

function parseImportText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const questions = [];
  let currentQ = null;

  const typePatterns = {
    order: /\[(Order|Sắp xếp)\]/gi,
    match: /\[(Match|Ghép cặp)\]/gi
  };

  for (let line of lines) {
    // Check for Question start: "1. Content" or just "1."
    const qMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (qMatch) {
      if (currentQ) finalizeParsedQuestion(currentQ, questions);

      const content = qMatch[2] || '';
      let type = 'single_choice'; // Default

      if (typePatterns.order.test(content)) type = 'drag_drop';
      else if (typePatterns.match.test(content)) type = 'matching';

      currentQ = {
        question: content.replace(typePatterns.order, '').replace(typePatterns.match, '').trim(),
        type,
        options: [],
        correct_temp: [],
        order_num: questions.length + 1
      };

      if (type === 'matching') currentQ.matches = [];
      continue;
    }

    if (!currentQ) continue;

    // Detect if this line is an option or match pair
    const optMatch = line.match(/^([a-zA-Z])\.\s+(.+)/);
    const isDDMatch = currentQ.type === 'drag_drop' && line.startsWith('-');
    const isMatchingMatch = currentQ.type === 'matching' && line.startsWith('-') && line.includes('->');

    if (optMatch && (currentQ.type === 'single_choice' || currentQ.type === 'multiple_choice')) {
      const letter = optMatch[1];
      const content = optMatch[2];
      const isCorrect = letter === letter.toUpperCase();

      currentQ.options.push(content);
      if (isCorrect) currentQ.correct_temp.push(content);
    } else if (isDDMatch) {
      currentQ.options.push(line.substring(1).trim());
    } else if (isMatchingMatch) {
      const parts = line.substring(1).split('->');
      if (parts.length === 2) {
        currentQ.matches.push({ left: parts[0].trim(), right: parts[1].trim() });
      }
    } else {
      // If it doesn't match an option pattern, it's part of the question content (multiline)
      if (currentQ.question) {
        currentQ.question += '\n' + line;
      } else {
        currentQ.question = line;
      }

      // Re-detect type if tags appear in subsequent lines
      if (typePatterns.order.test(line)) {
        currentQ.type = 'drag_drop';
        currentQ.question = currentQ.question.replace(typePatterns.order, '').trim();
      } else if (typePatterns.match.test(line)) {
        currentQ.type = 'matching';
        if (!currentQ.matches) currentQ.matches = [];
        currentQ.question = currentQ.question.replace(typePatterns.match, '').trim();
      }
    }
  }

  if (currentQ) finalizeParsedQuestion(currentQ, questions);

  return questions;
}

function finalizeParsedQuestion(q, list) {
  if (q.type === 'single_choice' || q.type === 'multiple_choice') {
    if (q.correct_temp.length > 1) {
      q.type = 'multiple_choice';
      q.correct_answer = q.correct_temp;
      q.options = q.options;
    } else {
      q.type = 'single_choice';
      q.correct_answer = q.correct_temp[0] || q.options[0];
      q.options = q.options;
    }
    delete q.correct_temp;
    list.push(q);
  } else if (q.type === 'drag_drop') {
    if (q.options.length > 0) {
      q.correct_answer = [...q.options];
      q.options = q.options;
      list.push(q);
    }
  } else if (q.type === 'matching') {
    if (q.matches && q.matches.length > 0) {
      const left = q.matches.map(m => m.left);
      const right = q.matches.map(m => m.right);
      q.options = { left, right };
      const correct = {};
      q.matches.forEach(m => correct[m.left] = m.right);
      q.correct_answer = correct;
      delete q.matches;
      list.push(q);
    }
  }
}

// ===== Paste Image Logic =====
function setupPasteHandler() {
  document.addEventListener('paste', async (e) => {
    // Only handle if target is textarea or input
    if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') return;

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          await uploadAndInsertImage(blob, e.target);
        }
      }
    }
  });
}

function setupDropHandler(el) {
  // Call this for new textareas
  // Actually simpler to just use global dragover/drop and check target
  // But dragover needs preventDefault to allow drop
}

async function uploadAndInsertImage(file, targetInput) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    try {
      // Show loading placeholder
      const originalVal = targetInput.value;
      const cursorPos = targetInput.selectionStart;
      const placeholder = '![Uploading...]';
      targetInput.value = originalVal.slice(0, cursorPos) + placeholder + originalVal.slice(cursorPos);

      const response = await fetch(`${API_URL}/upload/base64`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, source: 'editor' })
      });
      const data = await response.json();

      if (data.success) {
        // Replace placeholder
        const newVal = targetInput.value.replace(placeholder, `![Image](${data.url})`);
        targetInput.value = newVal;
        // Trigger change event for saving logic
        targetInput.dispatchEvent(new Event('input'));
        targetInput.dispatchEvent(new Event('change'));
      } else {
        alert('Upload failed: ' + data.error);
        targetInput.value = originalVal;
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    }
  };
  reader.readAsDataURL(file);
}


async function loadQuestions() {
  try {
    const response = await fetch(`${API_URL}/exams/${examId}/questions/edit`);
    questions = await response.json();
    renderQuestionList();
  } catch (error) {
    console.error('Error loading questions:', error);
  }
}

function renderQuestionList() {
  const container = document.getElementById('question-list-items');

  if (questions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Chưa có câu hỏi nào</p>
      </div>
    `;
    return;
  }

  const typeLabels = { single_choice: 'SC', multiple_choice: 'MC', drag_drop: 'DD', matching: 'Match' };

  container.innerHTML = questions.map((q, i) => `
    <div class="question-list-item ${q.id === selectedQuestionId ? 'active' : ''}" 
         draggable="true"
         ondragstart="handleListDragStart(event, ${i})"
         ondragover="handleListDragOver(event)"
         ondrop="handleListDrop(event, ${i})"
         onclick="selectQuestion(${q.id})">
      <span class="drag-handle" style="cursor: move; margin-right: 0.5rem; color: #ccc;">⋮⋮</span>
      <span class="order">${i + 1}</span>
      <span class="content">${escapeHtml(q.question).replace(/!\[.*?\]\(.*?\)/g, '🖼️ Hình ảnh')}</span>
      <span class="type">${typeLabels[q.type] || q.type}</span>
      <button class="btn-icon delete" onclick="event.stopPropagation(); deleteQuestion(${q.id})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');
}

// DnD Helpers
function handleListDragStart(e, index) {
  e.dataTransfer.setData('text/plain', index);
  e.dataTransfer.effectAllowed = 'move';
}

function handleListDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

async function handleListDrop(e, targetIndex) {
  e.preventDefault();
  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
  if (fromIndex === targetIndex) return;

  const movedItem = questions.splice(fromIndex, 1)[0];
  questions.splice(targetIndex, 0, movedItem);

  renderQuestionList();

  // Call API to save order
  const orders = questions.map((q, i) => ({ id: q.id, order_num: i }));
  try {
    await fetch(`${API_URL}/questions/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
  } catch (err) {
    console.error('Reorder failed', err);
  }
}

function selectQuestion(id) {
  selectedQuestionId = id;
  const question = questions.find(q => q.id === id);
  if (!question) return;

  renderQuestionList();
  renderQuestionEditor(question);
}

function changeQuestionType(newType) {
  const q = questions.find(item => item.id === selectedQuestionId);
  if (!q) return;

  if (q.type === newType) return;

  const oldType = q.type;
  const isScMcSwitch = ['single_choice', 'multiple_choice'].includes(oldType) &&
    ['single_choice', 'multiple_choice'].includes(newType);

  // SC <-> MC: preserve options, only adjust correct_answer format
  if (isScMcSwitch) {
    q.type = newType;

    // Convert correct_answer between formats
    if (newType === 'multiple_choice') {
      // SC -> MC: wrap single answer in array
      if (q.correct_answer && !Array.isArray(q.correct_answer)) {
        try {
          q.correct_answer = JSON.parse(q.correct_answer);
        } catch {
          q.correct_answer = q.correct_answer ? [q.correct_answer] : [];
        }
      }
      if (!Array.isArray(q.correct_answer)) {
        q.correct_answer = q.correct_answer ? [q.correct_answer] : [];
      }
    } else {
      // MC -> SC: take first selected answer
      let answers = q.correct_answer;
      if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch { answers = []; }
      }
      q.correct_answer = Array.isArray(answers) && answers.length > 0 ? answers[0] : '';
    }

    renderQuestionEditor(q);
    renderQuestionList();
    return;
  }

  // Different type: confirm and reset data
  if (confirm('Đổi loại câu hỏi sẽ xóa dữ liệu đáp án cũ. Bạn có chắc không?')) {
    q.type = newType;
    // Reset data defaults
    if (newType === 'matching') {
      q.options = { left: [], right: [] };
      q.correct_answer = {};
    } else if (newType === 'drag_drop') {
      q.options = [];
      q.correct_answer = [];
    } else { // MC/SC
      q.options = [];
      if (newType === 'multiple_choice') q.correct_answer = [];
      else q.correct_answer = '';
    }
    renderQuestionEditor(q);
    renderQuestionList();
  } else {
    // Revert select
    document.getElementById('edit-type').value = q.type;
  }
}

function renderQuestionEditor(question) {
  const editor = document.getElementById('question-editor');

  editor.innerHTML = `
    <h3 class="mb-2">Chỉnh sửa câu hỏi</h3>
    
    <form onsubmit="updateQuestionInline(event, ${question.id})">
      <div class="form-group">
        <label>Loại câu hỏi</label>
        <select id="edit-type" class="form-control" onchange="changeQuestionType(this.value)">
          <option value="single_choice" ${question.type === 'single_choice' ? 'selected' : ''}>Trắc nghiệm (1 đáp án)</option>
          <option value="multiple_choice" ${question.type === 'multiple_choice' ? 'selected' : ''}>Trắc nghiệm (nhiều đáp án)</option>
          <option value="drag_drop" ${question.type === 'drag_drop' ? 'selected' : ''}>Kéo thả sắp xếp</option>
          <option value="matching" ${question.type === 'matching' ? 'selected' : ''}>Kéo thả ghép cặp</option>
        </select>
      </div>
      
      <div class="form-group">
        <div class="flex justify-between items-center mb-1">
          <label>Câu hỏi</label>
          <button type="button" class="btn btn-secondary btn-sm" onclick="triggerImageUpload('edit-question')">📷 Chèn ảnh</button>
        </div>
        <textarea id="edit-question" class="form-control" required oninput="document.getElementById('q-preview').innerHTML = renderContent(this.value)">${escapeHtml(question.question)}</textarea>
        <div id="q-preview" class="question-preview-box mt-2">${renderContent(question.question)}</div>
      </div>
      
      ${(question.type === 'multiple_choice' || question.type === 'single_choice') ? renderMCEditor(question) :
      question.type === 'drag_drop' ? renderDDEditor(question) :
        renderMatchingEditor(question)}
      
      <div class="form-group">
        <div class="flex justify-between items-center mb-1">
          <label class="notes-label">Ghi chú (hiển thị trong Learn Mode)</label>
          <button type="button" class="btn btn-secondary btn-sm" onclick="triggerImageUpload('edit-notes')">📷 Chèn ảnh</button>
        </div>
        <textarea id="edit-notes" class="form-control notes-input" placeholder="Thêm ghi chú giải thích đáp án...">${escapeHtml(question.notes || '')}</textarea>
      </div>
      
      <div class="flex gap-2" style="margin-top: 1.5rem;">
        <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        <button type="button" class="btn btn-danger" onclick="deleteQuestion(${question.id})">Xóa câu hỏi</button>
      </div>
    </form>
  `;
}

function renderMCEditor(question) {
  const isMultiple = question.type === 'multiple_choice';
  const inputType = isMultiple ? 'checkbox' : 'radio';
  let correctArr = [];

  if (isMultiple) {
    if (Array.isArray(question.correct_answer)) {
      correctArr = question.correct_answer;
    } else {
      try {
        correctArr = JSON.parse(question.correct_answer);
      } catch (e) {
        correctArr = [];
      }
    }
  }

  return `
    <div class="form-group">
      <label>${isMultiple ? 'Các đáp án (tick tất cả đáp án đúng)' : 'Các đáp án (chọn đáp án đúng)'}</label>
      <div id="edit-options" class="options-editor">
        ${question.options.map((opt, i) => {
    const isChecked = isMultiple ? correctArr.includes(opt) : question.correct_answer === opt;
    return `
          <div class="option-editor-item">
            <input type="${inputType}" name="edit-correct" value="${i}" ${isChecked ? 'checked' : ''}>
            <input type="text" class="form-control edit-option" value="${escapeHtml(opt)}" required>
            <button type="button" class="btn-icon" onclick="removeEditOption(this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          `;
  }).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem" onclick="addEditOption('${inputType}')">+ Thêm đáp án</button>
    </div>
  `;
}

function renderDDEditor(question) {
  return `
    <div class="form-group">
      <label>Các mục (theo thứ tự đúng)</label>
      <div id="edit-dd-items" class="options-editor">
        ${question.correct_answer.map((item, i) => `
          <div class="option-editor-item">
            <span style="min-width: 30px; color: var(--text-muted);">${i + 1}.</span>
            <input type="text" class="form-control edit-dd-item" value="${escapeHtml(item)}" required>
            <button type="button" class="btn-icon" onclick="removeEditDDItem(this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem" onclick="addEditDDItem()">+ Thêm mục</button>
    </div>
  `;
}

function renderMatchingEditor(question) {
  const opts = question.options || { left: [], right: [] };
  const correctPairs = question.correct_answer || {};
  const pairs = opts.left.map(left => ({ left, right: correctPairs[left] || '' }));

  return `
    <div class="form-group">
      <label>Các cặp ghép (trái → phải)</label>
      <div id="edit-matching-pairs" class="options-editor">
        ${pairs.map((pair, i) => `
          <div class="option-editor-item matching-pair-editor">
            <span style="min-width: 30px; color: var(--text-muted);">${i + 1}.</span>
            <input type="text" class="form-control edit-match-left" value="${escapeHtml(pair.left)}" placeholder="Trái" required>
            <span style="color: var(--text-muted);">→</span>
            <input type="text" class="form-control edit-match-right" value="${escapeHtml(pair.right)}" placeholder="Phải" required>
            <button type="button" class="btn-icon" onclick="removeMatchingPair(this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem" onclick="addMatchingPair()">+ Thêm cặp</button>
    </div>
  `;
}

function addEditOption(inputType = 'radio') {
  const container = document.getElementById('edit-options');
  const index = container.querySelectorAll('.option-editor-item').length;
  const div = document.createElement('div');
  div.className = 'option-editor-item';
  div.innerHTML = `
    <input type="${inputType}" name="edit-correct" value="${index}">
    <input type="text" class="form-control edit-option" required placeholder="Nhập đáp án...">
    <button type="button" class="btn-icon" onclick="removeEditOption(this)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  container.appendChild(div);
}

// ... existing removeEditOption ...

// ... existing code ...

async function updateQuestionInline(event, id) {
  event.preventDefault();

  const question = questions.find(q => q.id === id);
  const type = question.type;
  const questionText = document.getElementById('edit-question').value;
  const notes = document.getElementById('edit-notes').value;

  let options, correct_answer;

  if (type === 'multiple_choice' || type === 'single_choice') {
    const optionInputs = document.querySelectorAll('.edit-option');
    options = [...optionInputs].map(input => input.value);

    if (type === 'multiple_choice') {
      // Checkboxes
      const selected = document.querySelectorAll('input[name="edit-correct"]:checked');
      if (selected.length === 0) {
        alert('Vui lòng chọn ít nhất một đáp án đúng!');
        return;
      }
      correct_answer = [...selected].map(cb => options[parseInt(cb.value)]);
    } else {
      // Radio (single choice)
      const selectedRadio = document.querySelector('input[name="edit-correct"]:checked');
      if (!selectedRadio) {
        alert('Vui lòng chọn đáp án đúng!');
        return;
      }
      correct_answer = options[parseInt(selectedRadio.value)];
    }
  } else if (type === 'drag_drop') {
    const ddInputs = document.querySelectorAll('.edit-dd-item');
    options = [...ddInputs].map(input => input.value);
    correct_answer = [...options];
  } else if (type === 'matching') {
    const leftInputs = document.querySelectorAll('.edit-match-left');
    const rightInputs = document.querySelectorAll('.edit-match-right');
    const leftItems = [...leftInputs].map(input => input.value);
    const rightItems = [...rightInputs].map(input => input.value);
    options = { left: leftItems, right: rightItems };
    correct_answer = {};
    leftItems.forEach((left, i) => {
      correct_answer[left] = rightItems[i];
    });
  }

  try {
    await fetch(`${API_URL}/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        question: questionText,
        options,
        correct_answer,
        notes,
        order_num: question.order_num
      })
    });

    await loadQuestions();
    selectQuestion(id);
  } catch (error) {
    alert('Có lỗi xảy ra. Vui lòng thử lại.');
  }
}

// ===== Question Modal =====
let mcOptions = ['', '', '', ''];
let ddItems = ['', '', '', ''];
let matchingPairs = [{ left: '', right: '' }, { left: '', right: '' }];

function openQuestionModal() {
  document.getElementById('question-modal-title').textContent = 'Thêm câu hỏi';
  document.getElementById('question-form').reset();
  document.getElementById('q-id').value = '';
  document.getElementById('q-type').value = 'single_choice';

  mcOptions = ['', '', '', ''];
  ddItems = ['', '', '', ''];
  matchingPairs = [{ left: '', right: '' }, { left: '', right: '' }];

  toggleQuestionType();
  document.getElementById('q-add-preview').innerHTML = '';
  document.getElementById('question-modal').classList.add('active');
}

function closeQuestionModal() {
  document.getElementById('question-modal').classList.remove('active');
}

function toggleQuestionType() {
  const type = document.getElementById('q-type').value;
  const isMC = type === 'single_choice' || type === 'multiple_choice';
  document.getElementById('mc-options').classList.toggle('hidden', !isMC);
  document.getElementById('dd-options').classList.toggle('hidden', type !== 'drag_drop');
  document.getElementById('matching-options').classList.toggle('hidden', type !== 'matching');

  // Update MC label
  const mcLabel = document.querySelector('#mc-options > label');
  if (mcLabel) {
    mcLabel.textContent = type === 'multiple_choice'
      ? 'Các đáp án (tick tất cả đáp án đúng)'
      : 'Các đáp án (chọn 1 đáp án đúng)';
  }

  if (isMC) {
    renderMCOptionsEditor(type === 'multiple_choice');
  } else if (type === 'drag_drop') {
    renderDDItemsEditor();
  } else if (type === 'matching') {
    renderMatchingPairsEditor();
  }
}

function renderMCOptionsEditor(isMultiple = false) {
  const container = document.getElementById('options-editor');
  const inputType = isMultiple ? 'checkbox' : 'radio';
  container.innerHTML = mcOptions.map((opt, i) => `
    <div class="option-editor-item">
      <input type="${inputType}" name="correct-option" value="${i}">
      <input type="text" class="form-control mc-option-input" value="${escapeHtml(opt)}" 
             placeholder="Đáp án ${i + 1}" onchange="mcOptions[${i}] = this.value">
      <button type="button" class="btn-icon" onclick="removeMCOption(${i})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
}

function addOption() {
  mcOptions.push('');
  renderMCOptionsEditor();
}

function removeMCOption(index) {
  mcOptions.splice(index, 1);
  renderMCOptionsEditor();
}

function renderDDItemsEditor() {
  const container = document.getElementById('dd-items-editor');
  container.innerHTML = ddItems.map((item, i) => `
    <div class="option-editor-item">
      <span style="min-width: 30px; color: var(--text-muted);">${i + 1}.</span>
      <input type="text" class="form-control dd-item-input" value="${escapeHtml(item)}" 
             placeholder="Mục ${i + 1}" onchange="ddItems[${i}] = this.value">
      <button type="button" class="btn-icon" onclick="removeDDItem(${i})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
}

function addDragItem() {
  ddItems.push('');
  renderDDItemsEditor();
}

function removeDDItem(index) {
  ddItems.splice(index, 1);
  renderDDItemsEditor();
}

function renderMatchingPairsEditor() {
  const container = document.getElementById('matching-pairs-editor');
  container.innerHTML = matchingPairs.map((pair, i) => `
    <div class="option-editor-item matching-pair-editor">
      <span style="min-width: 30px; color: var(--text-muted);">${i + 1}.</span>
      <input type="text" class="form-control match-left-input" value="${escapeHtml(pair.left)}" 
             placeholder="Trái" onchange="matchingPairs[${i}].left = this.value">
      <span style="color: var(--text-muted);">→</span>
      <input type="text" class="form-control match-right-input" value="${escapeHtml(pair.right)}" 
             placeholder="Phải" onchange="matchingPairs[${i}].right = this.value">
      <button type="button" class="btn-icon" onclick="removeMatchingPairModal(${i})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `).join('');
}

function addMatchingPairModal() {
  matchingPairs.push({ left: '', right: '' });
  renderMatchingPairsEditor();
}

function removeMatchingPairModal(index) {
  matchingPairs.splice(index, 1);
  renderMatchingPairsEditor();
}

async function saveQuestion(event) {
  event.preventDefault();

  const type = document.getElementById('q-type').value;
  const question = document.getElementById('q-question').value;
  const notes = document.getElementById('q-notes')?.value || '';

  // Collect options from inputs
  const optionInputs = document.querySelectorAll('.mc-option-input');
  mcOptions = [...optionInputs].map(input => input.value);

  const ddInputs = document.querySelectorAll('.dd-item-input');
  ddItems = [...ddInputs].map(input => input.value);

  const leftInputs = document.querySelectorAll('.match-left-input');
  const rightInputs = document.querySelectorAll('.match-right-input');
  matchingPairs = [...leftInputs].map((input, i) => ({
    left: input.value,
    right: rightInputs[i]?.value || ''
  }));

  let options, correct_answer;

  if (type === 'single_choice') {
    options = mcOptions.filter(o => o.trim());
    if (options.length < 2) {
      alert('Cần ít nhất 2 đáp án!');
      return;
    }
    const selectedRadio = document.querySelector('input[name="correct-option"]:checked');
    if (!selectedRadio) {
      alert('Vui lòng chọn đáp án đúng!');
      return;
    }
    correct_answer = mcOptions[parseInt(selectedRadio.value)];
    if (!correct_answer.trim()) {
      alert('Đáp án đúng không được để trống!');
      return;
    }
  } else if (type === 'multiple_choice') {
    options = mcOptions.filter(o => o.trim());
    if (options.length < 2) {
      alert('Cần ít nhất 2 đáp án!');
      return;
    }
    const selectedCheckboxes = document.querySelectorAll('input[name="correct-option"]:checked');
    if (selectedCheckboxes.length === 0) {
      alert('Vui lòng chọn ít nhất 1 đáp án đúng!');
      return;
    }
    correct_answer = [...selectedCheckboxes].map(cb => mcOptions[parseInt(cb.value)]).filter(a => a.trim());
    if (correct_answer.length === 0) {
      alert('Đáp án đúng không được để trống!');
      return;
    }
  } else if (type === 'drag_drop') {
    options = ddItems.filter(i => i.trim());
    if (options.length < 2) {
      alert('Cần ít nhất 2 mục!');
      return;
    }
    correct_answer = [...options];
  } else if (type === 'matching') {
    const validPairs = matchingPairs.filter(p => p.left.trim() && p.right.trim());
    if (validPairs.length < 2) {
      alert('Cần ít nhất 2 cặp ghép!');
      return;
    }
    options = {
      left: validPairs.map(p => p.left),
      right: validPairs.map(p => p.right)
    };
    correct_answer = {};
    validPairs.forEach(p => {
      correct_answer[p.left] = p.right;
    });
  }

  try {
    await fetch(`${API_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_id: parseInt(examId),
        type,
        question,
        options,
        correct_answer,
        notes,
        order_num: questions.length
      })
    });

    closeQuestionModal();
    await loadQuestions();
  } catch (error) {
    alert('Có lỗi xảy ra. Vui lòng thử lại.');
  }
}

async function deleteQuestion(id) {
  if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;

  try {
    await fetch(`${API_URL}/questions/${id}`, { method: 'DELETE' });

    if (selectedQuestionId === id) {
      selectedQuestionId = null;
      document.getElementById('question-editor').innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <h3>Chọn câu hỏi để chỉnh sửa</h3>
          <p>Hoặc thêm câu hỏi mới từ nút phía trên</p>
        </div>
      `;
    }

    await loadQuestions();
  } catch (error) {
    alert('Không thể xóa câu hỏi. Vui lòng thử lại.');
  }
}

// Duplicate functions removed


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
  toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message).replace(/\n/g, '<br>')}</span>
    `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

// ===== Utilities =====
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderContent(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    return `<div class="image-container"><img src="${url}" alt="${alt}" class="content-image"></div>`;
  });
  return html;
}

let activeImageTarget = null;
function triggerImageUpload(targetId) {
  activeImageTarget = document.getElementById(targetId);
  document.getElementById('general-image-upload').click();
}

document.getElementById('general-image-upload')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !activeImageTarget) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`${API_URL}/upload?source=editor`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const cursorPos = activeImageTarget.selectionStart;
      const text = activeImageTarget.value;
      const insert = `\n![Image](${data.url})\n`;
      activeImageTarget.value = text.slice(0, cursorPos) + insert + text.slice(cursorPos);
      activeImageTarget.dispatchEvent(new Event('input'));
    } else {
      alert(data.error || 'Upload failed');
    }
  } catch (err) { alert('Upload error'); }
  e.target.value = '';
});

// Close modal on overlay click
document.getElementById('question-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeQuestionModal();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', init);

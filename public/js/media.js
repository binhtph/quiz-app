const API_URL = '/api';
let allMedia = [];
let selectedFiles = new Set();
let viewMode = localStorage.getItem('mediaViewMode') || 'grid';

// ===== Initialize =====
async function init() {
    setupDragDrop();
    restoreViewMode();
    await loadMedia();
}

// ===== View Mode =====
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('mediaViewMode', mode);

    const grid = document.getElementById('media-grid');
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');

    if (mode === 'list') {
        grid.classList.add('list-view');
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    } else {
        grid.classList.remove('list-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    }
}

function restoreViewMode() {
    setViewMode(viewMode);
}

// ===== Drag & Drop =====
function setupDragDrop() {
    const zone = document.getElementById('upload-zone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, () => zone.classList.remove('dragover'));
    });

    zone.addEventListener('drop', e => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) uploadFiles(files);
    });
}

// ===== File Upload =====
function handleFileSelect(event) {
    const files = Array.from(event.target.files); // Convert to Array to persist after input reset
    if (files.length > 0) uploadFiles(files);
    event.target.value = ''; // Reset input
}

async function uploadFiles(files) {
    const total = files.length;
    let success = 0;
    let errors = [];

    showToast(`Đang upload ${total} file...`, 'info', 2000);

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_URL}/upload?keepName=true`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok && data.success) {
                success++;
            } else {
                console.error(`Failed to upload ${file.name}:`, data.error);
                errors.push(`${file.name}: ${data.error}`);
            }
        } catch (e) {
            console.error(`Error uploading ${file.name}:`, e);
            errors.push(`${file.name}: Lỗi kết nối`);
        }
    }

    if (success === total) {
        showToast(`Đã upload thành công ${success}/${total} file.`, 'success');
    } else if (success > 0) {
        showToast(`Upload xong ${success}/${total} file.\nLỗi ${errors.length} file.`, 'info');
        console.warn('Upload errors:', errors);
    } else {
        showToast(`Upload thất bại.\n${errors[0] || ''}`, 'error');
    }

    loadMedia();
}

// ===== Load Media =====
let allExams = [];

async function loadMedia() {
    try {
        const res = await fetch(`${API_URL}/media`);
        const data = await res.json();
        allMedia = data.files || [];
        allExams = data.exams || [];
        updateStats();
        updateExamFilter();
        renderMedia();
    } catch (e) {
        console.error('Error loading media:', e);
        document.getElementById('media-grid').innerHTML = `
      <div class="empty-state">
        <p>Không thể tải danh sách media.</p>
      </div>
    `;
    }
}

function updateStats() {
    const used = allMedia.filter(m => m.usedIn && m.usedIn.length > 0).length;
    document.getElementById('stat-total').textContent = allMedia.length;
    document.getElementById('stat-used').textContent = used;
    document.getElementById('stat-unused').textContent = allMedia.length - used;
}

function updateExamFilter() {
    const select = document.getElementById('filter-exam');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="all">Mọi Exam</option>';
    allExams.forEach(exam => {
        select.innerHTML += `<option value="${exam.id}">${escapeHtml(exam.title)}</option>`;
    });
    select.value = currentValue || 'all';
}

function filterMedia() {
    renderMedia();
}

function getFilteredMedia() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const usage = document.getElementById('filter-usage').value;
    const source = document.getElementById('filter-source').value;
    const examId = document.getElementById('filter-exam')?.value || 'all';

    return allMedia.filter(m => {
        const matchSearch = m.name.toLowerCase().includes(search);
        const isUsed = m.usedIn && m.usedIn.length > 0;
        const matchUsage = usage === 'all' || (usage === 'used' && isUsed) || (usage === 'unused' && !isUsed);

        // Detect source from filename prefix
        let fileSource = 'other';
        if (m.name.startsWith('upload-')) fileSource = 'upload';
        else if (m.name.startsWith('editor-')) fileSource = 'editor';
        else if (m.name.startsWith('logo-')) fileSource = 'logo';

        const matchSource = source === 'all' || source === fileSource;

        // Match exam filter
        let matchExam = examId === 'all';
        if (!matchExam && m.usedIn) {
            matchExam = m.usedIn.some(u => u.examId == examId);
        }

        return matchSearch && matchUsage && matchSource && matchExam;
    });
}

function getSourceTag(name) {
    if (name.startsWith('upload-')) return '<span class="media-tag source-upload">📤 Upload</span>';
    if (name.startsWith('editor-')) return '<span class="media-tag source-editor">✏️ Editor</span>';
    if (name.startsWith('logo-')) return '<span class="media-tag source-logo">🖼️ Logo</span>';
    return '<span class="media-tag source-other">📁 Khác</span>';
}

function renderMedia() {
    const grid = document.getElementById('media-grid');
    const filtered = getFilteredMedia();

    if (filtered.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <h3>Không tìm thấy media nào</h3>
        <p>Upload hình ảnh mới hoặc thay đổi bộ lọc</p>
      </div>
    `;
        return;
    }

    grid.innerHTML = filtered.map(m => {
        const isUsed = m.usedIn && m.usedIn.length > 0;
        const isSelected = selectedFiles.has(m.name);
        const ext = m.name.split('.').pop();
        const baseName = m.name.replace(/\.[^.]+$/, '');

        return `
      <div class="media-item ${isSelected ? 'selected' : ''}" data-name="${escapeHtml(m.name)}">
        <input type="checkbox" class="media-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelect('${escapeHtml(m.name)}')">
        <img src="/uploads/${encodeURIComponent(m.name)}" class="media-thumbnail" alt="${escapeHtml(m.name)}" loading="lazy" onerror="this.src='/uploads/placeholder.png'">
        <div class="media-info">
          <div class="media-name" data-original="${escapeHtml(m.name)}">
            <input type="text" class="inline-rename" value="${escapeHtml(baseName)}" 
                   onblur="saveRename(this, '${escapeHtml(m.name)}')" 
                   onkeydown="if(event.key==='Enter'){this.blur();}" 
                   title="Click để đổi tên">
            <span class="ext-label">.${ext}</span>
          </div>
          <div class="media-tags">
            ${getSourceTag(m.name)}
            ${isUsed ? `
              <span class="media-tag used">✅ Đang dùng</span>
              ${m.usedIn.slice(0, 1).map(u => `<span class="media-tag exam" title="${escapeHtml(u.question || '')}">${escapeHtml(u.examTitle || 'Exam')}</span>`).join('')}
              ${m.usedIn.length > 1 ? `<span class="media-tag">+${m.usedIn.length - 1}</span>` : ''}
            ` : '<span class="media-tag unused">⚠️ Chưa dùng</span>'}
          </div>
          <div class="media-actions-row">
            <button class="btn btn-secondary btn-sm" onclick="copyMarkdown('${escapeHtml(m.name)}')" title="Copy markdown">📋</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFile('${escapeHtml(m.name)}')" title="Xóa">🗑️</button>
          </div>
        </div>
      </div>
    `;
    }).join('');

    updateBulkActions();
}

// ===== Selection =====
function toggleSelect(name) {
    if (selectedFiles.has(name)) {
        selectedFiles.delete(name);
    } else {
        selectedFiles.add(name);
    }
    renderMedia();
}

function toggleSelectAll() {
    const filtered = getFilteredMedia();
    const allSelected = filtered.every(m => selectedFiles.has(m.name));

    if (allSelected) {
        filtered.forEach(m => selectedFiles.delete(m.name));
    } else {
        filtered.forEach(m => selectedFiles.add(m.name));
    }
    renderMedia();
}

function clearSelection() {
    selectedFiles.clear();
    renderMedia();
}

function updateBulkActions() {
    const bulkActions = document.getElementById('bulk-actions');
    const countSpan = document.getElementById('selected-count');

    if (selectedFiles.size > 0) {
        bulkActions.classList.add('active');
        countSpan.textContent = `${selectedFiles.size} file đã chọn`;
    } else {
        bulkActions.classList.remove('active');
    }
}

// ===== Actions =====
function copyMarkdown(name) {
    const markdown = `![Image](/uploads/${name})`;
    navigator.clipboard.writeText(markdown).then(() => {
        showToast('Đã copy markdown vào clipboard!', 'success');
    }).catch(() => {
        prompt('Copy thủ công:', markdown);
    });
}

async function saveRename(input, oldName) {
    const ext = oldName.split('.').pop();
    const oldBaseName = oldName.replace(/\.[^.]+$/, '');
    const newBaseName = input.value.trim();

    if (!newBaseName || newBaseName === oldBaseName) {
        input.value = oldBaseName; // Reset if empty
        return;
    }

    const newName = newBaseName + '.' + ext;

    try {
        const res = await fetch(`${API_URL}/media/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldName, newName })
        });
        const data = await res.json();

        if (data.success) {
            loadMedia();
        } else {
            showToast('Lỗi: ' + (data.error || 'Không thể đổi tên'), 'error');
            input.value = oldBaseName;
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
        input.value = oldBaseName;
    }
}

async function deleteFile(name) {
    if (!confirm(`Bạn có chắc muốn xóa file "${name}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/media/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            loadMedia();
        } else {
            showToast('Lỗi: ' + (data.error || 'Không thể xóa'), 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối server', 'error');
    }
}

async function deleteSelected() {
    if (selectedFiles.size === 0) return;

    if (!confirm(`Bạn có chắc muốn xóa ${selectedFiles.size} file đã chọn?`)) return;

    let success = 0;
    for (const name of selectedFiles) {
        try {
            const res = await fetch(`${API_URL}/media/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) success++;
        } catch (e) {
            console.error('Delete error:', e);
        }
    }

    showToast(`Đã xóa ${success}/${selectedFiles.size} file.`, 'success');
    selectedFiles.clear();
    loadMedia();
}

// ===== Utilities =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Start fade out before removing
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

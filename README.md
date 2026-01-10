# Quiz App - Ứng Dụng Trắc Nghiệm

Ứng dụng làm bài trắc nghiệm self-hosted chạy trên Docker. Dễ dàng tạo, quản lý và chia sẻ các bài thi trắc nghiệm.

## ✨ Tính năng

### 📝 Loại câu hỏi
- **Single Choice** - Chọn một đáp án đúng
- **Multiple Choice** - Chọn nhiều đáp án đúng
- **Drag & Drop** - Sắp xếp thứ tự
- **Matching** - Nối cặp tương ứng

### 🎮 Thi cử
- ⏱️ Timer đếm ngược
- 📌 Đánh dấu câu hỏi để xem lại
- 🔀 Shuffle câu hỏi và đáp án
- 📚 Learn Mode - Xem giải thích sau mỗi câu
- 🏆 Bảng xếp hạng điểm cao

### 🛠️ Quản lý
- 📋 Quản lý nhiều Exams
- 🔒 Mã PIN bảo vệ chỉnh sửa
- 🖼️ Upload logo cho Exam
- 📷 Paste hình ảnh vào câu hỏi
- 📁 Quản lý Media (upload, xóa, đổi tên)
- 💾 Export/Import backup (ZIP)

### 🔔 Realtime
- 📢 Thông báo kỷ lục mới (SSE)
- 👥 Multi-user với tên riêng

## 🚀 Cài đặt

### Docker (Khuyến nghị)

```bash
# Clone repo
git clone https://github.com/binhtph/quiz-app.git
cd quiz-app

# Build và chạy
docker compose up -d --build

# Xem logs
docker compose logs -f
```

Truy cập: **http://localhost**

### Local Development

```bash
npm install
npm start
```

Truy cập: **http://localhost:3000**

## 📁 Cấu trúc

```
quiz-app/
├── server/              # Backend Express + SQLite
│   ├── routes/          # API endpoints
│   ├── database.js      # Database setup
│   └── index.js         # Server entry
├── public/              # Frontend HTML/CSS/JS
│   ├── css/             # Styles
│   ├── js/              # JavaScript modules
│   └── *.html           # Pages
├── data/                # SQLite database (volume)
├── uploads/             # Uploaded images (volume)
├── Dockerfile
└── docker-compose.yml
```

## 🔧 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/exams` | Danh sách exams |
| POST | `/api/exams` | Tạo exam mới |
| GET | `/api/exams/:id` | Chi tiết exam + questions |
| PUT | `/api/exams/:id` | Cập nhật exam |
| DELETE | `/api/exams/:id` | Xóa exam |
| POST | `/api/questions` | Thêm câu hỏi |
| PUT | `/api/questions/:id` | Sửa câu hỏi |
| DELETE | `/api/questions/:id` | Xóa câu hỏi |
| GET | `/api/backup/export` | Export ZIP backup |
| POST | `/api/backup/import` | Import ZIP backup |
| POST | `/api/upload` | Upload file |
| GET | `/api/media` | Danh sách media |

## 📦 Backup & Restore

```bash
# Export: Tải file ZIP từ UI hoặc API
curl -o backup.zip http://localhost/api/backup/export

# Import: Upload file ZIP qua UI
# Hoặc API:
curl -X POST -F "backup=@backup.zip" http://localhost/api/backup/import
```

## 📄 License

MIT License

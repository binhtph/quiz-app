# Quiz App - Ứng Dụng Trắc Nghiệm

Ứng dụng làm bài trắc nghiệm self-hosted chạy trên Docker.

## Tính năng

- ✅ Multiple Choice & Drag and Drop
- ✅ Timer đếm ngược
- ✅ Mark câu hỏi
- ✅ Chấm điểm tự động
- ✅ Quản lý nhiều Exams
- ✅ Editor không cần login

## Chạy với Docker

```bash
# Build và chạy
docker-compose up -d --build

# Xem logs
docker-compose logs -f
```

Truy cập: http://localhost:80

## Chạy local (dev)

```bash
npm install
npm start
```

## Cấu trúc

```
quiz-app/
├── server/          # Backend Express + SQLite
├── public/          # Frontend HTML/CSS/JS
├── data/            # SQLite database
├── Dockerfile
└── docker-compose.yml
```

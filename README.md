# Aero-Twin Monorepo Setup (Frontend + Backend + Docker + Supabase-compatible Postgres)

Monorepo này phục vụ MVP hackathon Aero-Twin với:

- Frontend: Next.js App Router
- Backend: FastAPI
- Database: PostgreSQL (local, tương thích Supabase)
- DB Admin: pgAdmin

## 1) Prerequisites

- Windows + Docker Desktop (khuyến nghị bật WSL2 backend)
- Docker daemon phải chạy trước khi dùng `docker-compose`
- Node.js chỉ cần nếu bạn muốn chạy frontend ngoài Docker

## 2) Cấu trúc chính

```text
ASIAN-HACKATHON/
├─ frontend/
├─ backend/
├─ supabase/
│  └─ init.sql
├─ docker-compose.yml
├─ .env.example
├─ PLAN_SETUP_MONOREPO.md
└─ README.md
```

## 3) Bắt buộc: tạo `.env` trước khi chạy compose

File `docker-compose.yml` đang dùng `env_file: .env`, nên bắt buộc tạo `.env` trước khi chạy.

```powershell
Copy-Item .env.example .env
```

## 4) Run stack bằng Docker

```powershell
Set-Location -Path "D:\workspace\ASIAN-HACKATHON"
docker-compose up --build -d
```

## 5) Endpoints sau khi chạy

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- pgAdmin: [http://localhost:8080](http://localhost:8080)

## 6) Smoke tests

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Kết quả mong đợi:

```json
{"status":"ok"}
```

## 7) Troubleshooting nhanh

### Docker daemon chưa chạy

Nếu gặp lỗi pipe `dockerDesktopLinuxEngine`, hãy mở Docker Desktop và đợi trạng thái **Engine running**, sau đó chạy lại:

```powershell
docker-compose build backend
docker-compose up -d
```

### Reset DB local

```powershell
docker-compose down -v
docker-compose up --build -d
```

## 8) Chuyển sang Supabase hosted (sau hackathon)

- Đổi `DATABASE_URL` trong `.env` sang connection string của Supabase.
- (Tuỳ chọn) thêm `SUPABASE_URL`, `SUPABASE_ANON_KEY` cho frontend/backend khi tích hợp Auth hoặc SDK.

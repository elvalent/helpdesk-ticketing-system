# Helpdesk - Tiket IT

Aplikasi Helpdesk untuk pengajuan tiket masalah IT.

## Tech Stack
- Backend: Laravel 11 + MySQL + Sanctum
- Frontend: React + Vite

## Cara Jalanin

### Backend
```bash
cd helpdesk-api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve

### Frontend
cd helpdesk-web
npm install
npm run dev
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Ubah kolom status biar bisa terima 4 nilai: open, in_progress, resolved, closed
        DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE tickets MODIFY COLUMN status ENUM('open','in_progress') NOT NULL DEFAULT 'open'");
    }
};
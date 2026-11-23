<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        $query = Ticket::with(['user:id,name,email', 'handler:id,name,email'])
            ->select(['id', 'user_id', 'handled_by', 'title', 'description', 'priority', 'status', 'created_at', 'updated_at'])
            ->latest();

        if ($user->role !== 'it') {
            // User cuma liat tiket dia sendiri
            $query->where('user_id', $user->id);
        } else {
            // IT cuma liat: tiket belum diambil + tiket yang dia ambil sendiri
            // Tiket yang udah diambil IT lain NGGAK BOCOR ke dia
            $query->where(function ($q) use ($user) {
                $q->whereNull('handled_by')
                  ->orWhere('handled_by', $user->id);
            });
        }

        return response()->json($query->limit(50)->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'priority' => 'in:low,medium,high',
        ]);

        $ticket = Ticket::create([
            'user_id' => auth()->id(),
            'handled_by' => null,
            'title' => $request->title,
            'description' => $request->description,
            'priority' => $request->priority ?? 'medium',
            'status' => 'open',
        ]);

        return response()->json($ticket->load(['user:id,name,email', 'handler:id,name,email']), 201);
    }

    public function update(Request $request, Ticket $ticket)
    {
        $validated = $request->validate([
            'status' => 'required|in:open,in_progress,resolved,closed',
        ]);

        $user = auth()->user();

        // Kalau IT lain coba ngutak-atik tiket yang bukan punya dia, tolak
        if ($user->role === 'it' && $ticket->handled_by && $ticket->handled_by !== $user->id) {
            return response()->json(['message' => 'Tiket ini sudah diambil IT lain'], 403);
        }

        // Logic Assign:
        // in_progress = kunci ke IT yang klik
        // open = lepas lagi, bisa diambil IT lain
        // resolved / closed = tetep ke-kunci ke IT yang nyelesain
        if ($validated['status'] === 'in_progress') {
            $ticket->forceFill([
                'status' => 'in_progress',
                'handled_by' => $user->id,
            ])->save();
        } elseif ($validated['status'] === 'open') {
            $ticket->forceFill([
                'status' => 'open',
                'handled_by' => null,
            ])->save();
        } else {
            $ticket->forceFill([
                'status' => $validated['status'],
                'handled_by' => $ticket->handled_by ?? $user->id,
            ])->save();
        }

        return response()->json($ticket->fresh()->load(['user:id,name,email', 'handler:id,name,email']));
    }

    public function destroy(Ticket $ticket)
    {
        $ticket->delete();
        return response()->json(['message' => 'Tiket dihapus']);
    }
}
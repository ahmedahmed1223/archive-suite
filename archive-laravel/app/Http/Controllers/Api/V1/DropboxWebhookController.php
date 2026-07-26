<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDropboxWebhook;
use App\Services\Dropbox\DropboxWebhookProcessor;
use Illuminate\Http\Request;

class DropboxWebhookController extends Controller
{
    public function verify(Request $request) { return response((string) $request->query('challenge'), 200)->header('Content-Type', 'text/plain'); }
    public function receive(Request $request, DropboxWebhookProcessor $processor)
    {
        $secret = (string) config('services.dropbox.webhook_secret');
        $raw = $request->getContent(); $signature = (string) $request->header('X-Dropbox-Signature');
        if ($secret === '' || ! hash_equals(hash_hmac('sha256', $raw, $secret), $signature)) return response()->json(['ok' => false, 'error' => 'Invalid Dropbox signature.'], 401);
        $payload = $request->json()->all();
        $eventId = hash('sha256', $raw);
        $accepted = $processor->accept($eventId, $payload);
        // Only dispatch a sync for genuinely new events — idempotency already
        // rejected replays above, so a duplicate never triggers a second sync.
        if ($accepted) ProcessDropboxWebhook::dispatch($eventId, $payload);
        return response()->json(['ok' => true, 'accepted' => $accepted]);
    }
}

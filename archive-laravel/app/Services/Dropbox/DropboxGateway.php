<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/** Small HTTP boundary so Dropbox behavior can be faked in Laravel tests. */
class DropboxGateway
{
    public function exchangeAuthorizationCode(string $code, string $verifier): array
    {
        return $this->oauth()->asForm()->post('https://api.dropboxapi.com/oauth2/token', [
            'code' => $code, 'grant_type' => 'authorization_code', 'code_verifier' => $verifier,
            'client_id' => config('services.dropbox.client_id'), 'client_secret' => config('services.dropbox.client_secret'),
            'redirect_uri' => config('services.dropbox.redirect_uri'),
        ])->throw()->json();
    }
    public function listFolder(string $token, string $path, ?string $cursor = null): array
    {
        return $this->api($token)->post($cursor ? 'https://api.dropboxapi.com/2/files/list_folder/continue' : 'https://api.dropboxapi.com/2/files/list_folder', $cursor ? ['cursor' => $cursor] : ['path' => $path, 'recursive' => false])->throw()->json();
    }
    public function uploadStream(string $token, string $path, $stream): Response
    {
        return $this->retry($this->api($token)->withBody(stream_get_contents($stream), 'application/octet-stream')->withHeaders(['Dropbox-API-Arg' => json_encode(['path' => $path, 'mode' => 'add', 'autorename' => true])]), 'https://content.dropboxapi.com/2/files/upload');
    }
    public function downloadStream(string $token, string $path): Response
    {
        return $this->retry($this->api($token)->withHeaders(['Dropbox-API-Arg' => json_encode(['path' => $path])]), 'https://content.dropboxapi.com/2/files/download');
    }
    public function refreshAccessToken(string $refreshToken): array
    {
        return $this->oauth()->asForm()->post('https://api.dropboxapi.com/oauth2/token', ['grant_type' => 'refresh_token', 'refresh_token' => $refreshToken, 'client_id' => config('services.dropbox.client_id'), 'client_secret' => config('services.dropbox.client_secret')])->throw()->json();
    }
    private function oauth(): PendingRequest { return Http::acceptJson()->timeout(20); }
    private function api(string $token): PendingRequest { return Http::acceptJson()->withToken($token)->timeout(30); }
    private function retry(PendingRequest $request, string $url): Response
    {
        $response = $request->post($url);
        for ($attempt = 0; $attempt < 2 && ($response->status() === 429 || $response->serverError()); $attempt++) {
            usleep((int) (100000 * (2 ** $attempt)));
            $response = $request->post($url);
        }
        return $response;
    }
}

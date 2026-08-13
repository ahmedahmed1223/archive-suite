<?php

declare(strict_types=1);

namespace App\Mcp\Resources;

use App\Http\Controllers\Api\V1\RecordsController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\MimeType;
use Laravel\Mcp\Server\Contracts\HasUriTemplate;
use Laravel\Mcp\Server\Resource;
use Laravel\Mcp\Support\UriTemplate;

#[Description("An archive record's metadata, addressed by id. Read-only, same data as get_record.")]
#[MimeType('application/json')]
class RecordResource extends Resource implements HasUriTemplate
{
    use DelegatesToHttpController;

    public function uriTemplate(): UriTemplate
    {
        return new UriTemplate('archive://records/{id}');
    }

    public function handle(Request $request): Response
    {
        $result = $this->delegate(
            $request,
            RecordsController::class,
            'show',
            [],
            ['id' => (string) $request->string('id')],
        );

        return Response::json($result);
    }
}

<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\RecordResource;
use App\Mcp\Tools\CreateReviewRequestTool;
use App\Mcp\Tools\GetRecordTool;
use App\Mcp\Tools\GetSystemStatusTool;
use App\Mcp\Tools\ListArchiveTypesTool;
use App\Mcp\Tools\SearchRecordsTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('Archive Suite MCP Server')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
    Read-only access to the Archive Suite catalog: search records, read a
    record's metadata, list archive types, and check system status. To
    request a change (edit, tag, reclassify), use create_review_request —
    it only creates a draft for a human to approve; it never writes the
    change itself. This server never executes raw SQL, exposes storage
    paths, or runs system commands.
    MARKDOWN
)]
class ArchiveMcpServer extends Server
{
    protected array $tools = [
        SearchRecordsTool::class,
        GetRecordTool::class,
        ListArchiveTypesTool::class,
        GetSystemStatusTool::class,
        CreateReviewRequestTool::class,
    ];

    protected array $resources = [
        RecordResource::class,
    ];

    protected array $prompts = [
        //
    ];
}

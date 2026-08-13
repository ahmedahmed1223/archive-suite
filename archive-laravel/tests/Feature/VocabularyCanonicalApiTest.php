<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class VocabularyCanonicalApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_alias_can_point_to_a_canonical_term(): void
    {
        $canonical = $this->postJson('/api/v1/vocabulary', ['term' => 'سياسة', 'kind' => 'tag'], $this->authHeaders())->assertCreated()->json('term.id');
        $this->postJson('/api/v1/vocabulary', ['term' => 'سياسي', 'kind' => 'tag', 'canonicalTermId' => $canonical, 'aliases' => 'policy'], $this->authHeaders())->assertCreated()->assertJsonPath('term.canonicalTermId', $canonical);
    }

    public function test_canonical_term_must_belong_to_the_current_user(): void
    {
        $this->postJson('/api/v1/vocabulary', ['term' => 'سياسي', 'canonicalTermId' => 'foreign-term'], $this->authHeaders())->assertUnprocessable()->assertJsonPath('ok', false);
    }
}

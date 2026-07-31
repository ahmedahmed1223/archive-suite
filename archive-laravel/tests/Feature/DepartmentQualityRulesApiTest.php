<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class DepartmentQualityRulesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_quality_preview_is_limited_to_its_department_and_type(): void
    {
        $this->putJson('/api/v1/department-quality-rules', ['departmentId' => 'news', 'typeId' => 'video', 'requiredFields' => ['summary', 'date']], $this->authHeaders())->assertCreated();
        $this->postJson('/api/v1/department-quality-rules/preview', ['departmentId' => 'news', 'typeId' => 'video', 'metadata' => ['summary' => 'خبر']], $this->authHeaders())
            ->assertOk()->assertJsonPath('ready', false)->assertJsonPath('missingFields.0', 'date');
        $this->postJson('/api/v1/department-quality-rules/preview', ['departmentId' => 'archive', 'typeId' => 'video', 'metadata' => []], $this->authHeaders())
            ->assertOk()->assertJsonPath('ready', true)->assertJsonCount(0, 'missingFields');
    }
}

<?php

namespace Tests\Unit\Services\MaterialStages;

use App\Services\MaterialStages\MaterialStagesService;
use PHPUnit\Framework\TestCase;
use stdClass;

class MaterialStagesServiceTest extends TestCase
{
    public function testDeriveStageTechCheckFailed(): void
    {
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        $failedJob = new stdClass();
        $failedJob->record_id = 'test-1';

        $stage = MaterialStagesService::deriveStage($recordData, $failedJob, null, true);
        $this->assertEquals('tech_check_failed', $stage);
    }

    public function testDeriveStageAwaitingPeer(): void
    {
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        $inReview = new stdClass();
        $inReview->record_id = 'test-1';

        $stage = MaterialStagesService::deriveStage($recordData, null, $inReview, true);
        $this->assertEquals('awaiting_peer', $stage);
    }

    public function testDeriveStageIncompleteDescription(): void
    {
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => [
                'status' => 'red',
                'missing' => ['description', 'tags'],
            ],
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        $stage = MaterialStagesService::deriveStage($recordData, null, null, true);
        $this->assertEquals('incomplete_description', $stage);
    }

    public function testDeriveStageMissingRights(): void
    {
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        $stage = MaterialStagesService::deriveStage($recordData, null, null, false);
        $this->assertEquals('missing_rights', $stage);
    }

    public function testDeriveStageNewReceipt(): void
    {
        $oneDayAgo = date('c', time() - 3600);
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => $oneDayAgo,
            'updatedAt' => $oneDayAgo,
        ];

        $stage = MaterialStagesService::deriveStage($recordData, null, null, true);
        $this->assertEquals('new_receipt', $stage);
    }

    public function testDeriveStageCompletedToday(): void
    {
        $today = date('c');
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => date('c', time() - 86400 * 7), // 7 days ago
            'updatedAt' => $today,
        ];

        $stage = MaterialStagesService::deriveStage($recordData, null, null, true);
        $this->assertEquals('completed_today', $stage);
    }

    public function testDeriveStageReadyForApproval(): void
    {
        $weekAgo = date('c', time() - 86400 * 7);
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'green'],
            'createdAt' => $weekAgo,
            'updatedAt' => $weekAgo,
        ];

        $stage = MaterialStagesService::deriveStage($recordData, null, null, true);
        $this->assertEquals('ready_for_approval', $stage);
    }

    public function testStagePriorityTechCheckFailedOverOthers(): void
    {
        // Tech check failed takes priority even if other conditions are met
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'red'],
            'createdAt' => date('c', time() - 3600),
            'updatedAt' => date('c'),
        ];

        $failedJob = new stdClass();
        $failedJob->record_id = 'test-1';

        $stage = MaterialStagesService::deriveStage($recordData, $failedJob, null, false);
        $this->assertEquals('tech_check_failed', $stage);
    }

    public function testStagePriorityAwaitingPeerOverIncomplete(): void
    {
        // Awaiting peer takes priority over incomplete description
        $recordData = [
            'title' => 'Test Record',
            'descriptorCompletion' => ['status' => 'red'],
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ];

        $inReview = new stdClass();
        $inReview->record_id = 'test-1';

        $stage = MaterialStagesService::deriveStage($recordData, null, $inReview, false);
        $this->assertEquals('awaiting_peer', $stage);
    }
}

<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class TimedDescriptionSegmentsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_an_editor_can_create_and_list_a_frame_bounded_description_segment(): void
    {
        $created = $this->postJson('/api/v1/records/video-1/timed-description-segments', [
            'startFrame' => 120,
            'endFrame' => 360,
            'title' => 'افتتاح المؤتمر',
            'subjects' => ['مؤتمر'],
            'place' => 'قاعة التحرير',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('segment.startFrame', 120)
            ->assertJsonPath('segment.endFrame', 360);

        $this->getJson('/api/v1/records/video-1/timed-description-segments', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('segments.0.id', $created->json('segment.id'))
            ->assertJsonPath('segments.0.subjects.0', 'مؤتمر');
    }

    public function test_an_editor_can_correct_or_remove_a_timed_description_without_altering_its_record(): void
    {
        $created = $this->postJson('/api/v1/records/video-1/timed-description-segments', [
            'startFrame' => 120,
            'endFrame' => 360,
            'title' => 'وصول الضيوف',
        ], $this->authHeaders())->assertCreated();
        $segmentId = $created->json('segment.id');

        $this->patchJson('/api/v1/timed-description-segments/'.$segmentId, [
            'startFrame' => 150,
            'endFrame' => 420,
            'description' => 'تم تصحيح حدود اللقطة.',
            'subjects' => ['ضيوف'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('segment.recordId', 'video-1')
            ->assertJsonPath('segment.startFrame', 150)
            ->assertJsonPath('segment.description', 'تم تصحيح حدود اللقطة.');

        $this->deleteJson('/api/v1/timed-description-segments/'.$segmentId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }
}

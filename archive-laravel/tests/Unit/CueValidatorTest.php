<?php

namespace Tests\Unit;

use App\Services\Media\CueValidator;
use PHPUnit\Framework\TestCase;

class CueValidatorTest extends TestCase
{
    public function test_a_well_ordered_non_overlapping_cue_list_is_valid(): void
    {
        $errors = CueValidator::validate([
            ['startSeconds' => 0.0, 'endSeconds' => 2.0, 'text' => 'a'],
            ['startSeconds' => 2.0, 'endSeconds' => 4.0, 'text' => 'b'],
            ['startSeconds' => 5.0, 'endSeconds' => 6.0, 'text' => 'c'],
        ]);

        $this->assertSame([], $errors);
    }

    public function test_out_of_order_start_times_are_rejected(): void
    {
        $errors = CueValidator::validate([
            ['startSeconds' => 5.0, 'endSeconds' => 6.0, 'text' => 'a'],
            ['startSeconds' => 1.0, 'endSeconds' => 2.0, 'text' => 'b'],
        ]);

        $this->assertNotSame([], $errors);
        $this->assertStringContainsString('chronological order', $errors[0]);
    }

    public function test_overlapping_cues_are_rejected(): void
    {
        $errors = CueValidator::validate([
            ['startSeconds' => 0.0, 'endSeconds' => 3.0, 'text' => 'a'],
            ['startSeconds' => 2.0, 'endSeconds' => 5.0, 'text' => 'b'],
        ]);

        $this->assertNotSame([], $errors);
        $this->assertStringContainsString('overlaps', $errors[0]);
    }

    public function test_a_cue_ending_before_it_starts_is_rejected(): void
    {
        $errors = CueValidator::validate([
            ['startSeconds' => 3.0, 'endSeconds' => 1.0, 'text' => 'a'],
        ]);

        $this->assertNotSame([], $errors);
        $this->assertStringContainsString('end time must be after start time', $errors[0]);
    }

    public function test_adjacent_cues_that_touch_but_do_not_overlap_are_valid(): void
    {
        $errors = CueValidator::validate([
            ['startSeconds' => 0.0, 'endSeconds' => 2.0, 'text' => 'a'],
            ['startSeconds' => 2.0, 'endSeconds' => 4.0, 'text' => 'b'],
        ]);

        $this->assertSame([], $errors);
    }

    public function test_empty_cue_list_is_valid(): void
    {
        $this->assertSame([], CueValidator::validate([]));
    }
}

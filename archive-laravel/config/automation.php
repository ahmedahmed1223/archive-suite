<?php

return [
    // V1-758B: reversibility switch for event-driven automation triggers
    // (RunMatchingAutomationRules). Flip to false to fall back to the
    // manual/scheduled run() endpoint only, without touching code.
    'event_driven_enabled' => (bool) env('AUTOMATION_EVENT_DRIVEN', true),
];

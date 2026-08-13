# AI-806 — Multimodal AI evaluation for v1.2

[العربية](ai-multimodal-evaluation-v1.2.ar.md)

## Decision

External image generation, transcription, and reranking are not enabled in
v1.2. The existing Whisper and OCR production paths remain the approved
paths. This is an intentional no-go decision: archive files and audio are not
sent to a new provider merely because the Laravel AI SDK supports it.

## Reopening criteria

Any future production path requires a representative Arabic accuracy measure,
a departmental cost ceiling, data-owner approval for content transfer, and a
rollback plan that preserves the existing paths. Outputs remain suggestions
requiring human review.

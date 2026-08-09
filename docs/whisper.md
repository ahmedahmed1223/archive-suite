# Whisper transcription

[العربية](whisper.ar.md) · [Documentation](README.md)

Archive Suite uses `whisper-ctranslate2` for supported media transcription. The
Laravel worker invokes the executable and produces VTT, SRT, and TTML artifacts
that remain subject to the record's permissions and review workflow.

## CPU baseline

CPU with `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=int8` is the portable
baseline. The default model is `large-v3`; allow enough storage for its model
cache and enough time for the first model acquisition. For a smaller test or a
resource-constrained installation, select a smaller compatible model before
processing production records.

```dotenv
WHISPER_BINARY=whisper-ctranslate2
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=ar
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_DIARIZE=false
```

## GPU operation

CUDA operation requires a compatible NVIDIA driver, CUDA runtime, GPU-enabled
Python dependencies, and sufficient device memory for the selected model. Use
`WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16` only after the GPU
acceptance check succeeds. A CPU installation does not require GPU components.

## Speaker diarization and safety

Speaker diarization is separate from base transcription. Enable it only after
configuring the documented Hugging Face token and reviewing the provider's data
handling terms. Never place `HF_TOKEN` in source control, logs, support bundles,
or release assets.

Transcription output is generated content. Review names, dates, and sensitive
statements against the source media before publication. If a job fails, inspect
the worker diagnostics, confirm the executable and model cache are accessible,
and retry through the normal media-job workflow.

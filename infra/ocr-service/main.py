"""
PaddleOCR microservice — FastAPI wrapper around PaddleOCR for Archive Suite.
Accepts image uploads (JPEG/PNG/WEBP) and returns extracted text with bounding boxes.
"""
import os
import io
import logging
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-service")

# Initialize OCR engine once at startup (downloads models if not cached)
lang = os.getenv("OCR_LANG", "ar")
use_gpu = os.getenv("OCR_USE_GPU", "false").lower() == "true"
MAX_FILE_MB = float(os.getenv("MAX_FILE_SIZE_MB", "20"))

logger.info(f"Initializing PaddleOCR (lang={lang}, gpu={use_gpu})")
ocr_engine = PaddleOCR(
    lang=lang,
    use_angle_cls=True,
    use_gpu=use_gpu,
    show_log=False,
    ocr_version="PP-OCRv4",     # v4 = the stable "v3 generation" models
)
logger.info("PaddleOCR ready.")

app = FastAPI(title="Archive OCR Service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "lang": lang, "gpu": use_gpu}

@app.post("/ocr")
async def extract_text(
    file: UploadFile = File(...),
    lang_override: Optional[str] = Query(None, alias="lang"),
):
    """
    POST /ocr  multipart file upload (image or PDF page as image).
    Returns: { text: str, lines: [{text, confidence, bbox}], lang: str }
    """
    # Validate file size
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(413, f"File too large ({size_mb:.1f} MB > {MAX_FILE_MB} MB limit)")

    # Validate MIME / magic bytes
    is_image = any(contents.startswith(sig) for sig in [b"\xff\xd8\xff", b"\x89PNG"])
    if not is_image:
        raise HTTPException(415, "Only JPEG and PNG images are supported")

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        img_array = np.array(img)
    except Exception as e:
        raise HTTPException(400, f"Cannot decode image: {e}")

    # Run OCR
    try:
        results = ocr_engine.ocr(img_array, cls=True)
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(500, "OCR processing failed")

    # Flatten results
    lines = []
    full_text_parts = []
    if results and results[0]:
        for item in results[0]:
            bbox, (text, confidence) = item
            lines.append({"text": text, "confidence": round(float(confidence), 3), "bbox": bbox})
            full_text_parts.append(text)

    return JSONResponse({
        "text": "\n".join(full_text_parts),
        "lines": lines,
        "lang": lang_override or lang,
        "pageCount": 1,
    })


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8788"))
    uvicorn.run(app, host="0.0.0.0", port=port)

FROM python:3.12.11-slim@sha256:47ae396f09c1303b8653019811a8498470603d7ffefc29cb07c88f1f8cb3d19f

# Install system deps for PaddlePaddle + OpenMP (libgomp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    wget curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PaddleOCR models (Arabic + multilingual)
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ar', show_log=False)"

COPY main.py .

ENV OCR_LANG=ar
ENV OCR_USE_GPU=false
ENV MAX_FILE_SIZE_MB=20
ENV HOME=/home/ocruser

RUN useradd -r -u 1000 -m -d /home/ocruser ocruser && \
    mkdir -p /home/ocruser/.paddleocr && \
    if [ -d /root/.paddleocr ]; then cp -a /root/.paddleocr/. /home/ocruser/.paddleocr/; fi && \
    chown -R ocruser:ocruser /app /home/ocruser
USER 1000:1000

EXPOSE 8788
CMD ["python", "main.py"]

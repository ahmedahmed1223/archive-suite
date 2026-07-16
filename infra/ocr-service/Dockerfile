FROM python:3.13.14-slim@sha256:6771159cd4fa5d9bba1258caf0b82e6b73458c694d178ad97c5e925c2d0e1a91

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

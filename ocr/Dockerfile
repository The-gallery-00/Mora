FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    FLAGS_use_mkldnn=0 \
    FLAGS_enable_pir_api=0 \
    FLAGS_enable_pir_in_executor=0 \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .
RUN python -c "from src.pipeline.extract_pipeline import BusinessCardPipeline; BusinessCardPipeline(lang='korean')"

EXPOSE 8080

CMD ["sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker --timeout 300 --graceful-timeout 30 -b 0.0.0.0:${PORT:-8080} app:app"]

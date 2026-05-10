package com.mora.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final RestTemplate restTemplate;

    @Value("${app.openai-api-key}")
    private String openaiApiKey;

    private static final String OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

    public EmbeddingService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * 텍스트를 OpenAI text-embedding-ada-002 모델로 임베딩 벡터 문자열로 변환한다.
     * API 키가 미설정이거나 호출 실패 시 null을 반환한다.
     *
     * @param text 임베딩할 입력 텍스트 (명함 정보 등)
     * @return 임베딩 벡터 문자열 (예: "[0.0023, -0.0091, ...]") 또는 null
     */
    @SuppressWarnings("unchecked")
    public String getEmbedding(String text) {
        // API 키가 설정되지 않았으면 임베딩을 건너뛴다
        if (openaiApiKey == null || openaiApiKey.isBlank()) {
            log.warn("OpenAI API key not configured, skipping embedding generation");
            return null;
        }

        try {
            // HTTP 요청 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);  // Content-Type: application/json
            headers.setBearerAuth(openaiApiKey);                 // Authorization: Bearer {API_KEY}

            // 요청 바디: 임베딩할 텍스트와 모델명
            Map<String, Object> body = Map.of(
                    "input", text,
                    "model", "text-embedding-ada-002"
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            // OpenAI API에 POST 요청을 보내고 응답을 Map으로 받는다
            ResponseEntity<Map> response = restTemplate.exchange(
                    OPENAI_EMBEDDING_URL,
                    HttpMethod.POST,
                    request,
                    Map.class
            );

            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) return null;

            // 응답 구조: { "data": [ { "embedding": [0.0023, -0.0091, ...] } ] }
            List<Map<String, Object>> data = (List<Map<String, Object>>) responseBody.get("data");
            if (data == null || data.isEmpty()) return null;

            // 첫 번째 결과의 embedding 배열을 추출
            List<Double> embedding = (List<Double>) data.get(0).get("embedding");
            // List<Double>.toString()은 "[0.0023, -0.0091, ...]" 형태 → pgvector CAST에 사용
            return embedding.toString();
        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage());
            return null;
        }
    }
}

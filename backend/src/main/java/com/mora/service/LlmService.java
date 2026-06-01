package com.mora.service;

import com.mora.dto.llm.ChatRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class LlmService {

    private final RestTemplate restTemplate;

    @Value("${app.llm-service-url}")
    private String llmServiceUrl;

    public LlmService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> chat(ChatRequest chatRequest, String authorizationHeader) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (authorizationHeader != null) {
                headers.set("Authorization", authorizationHeader);
            }

            // LLM 서버가 snake_case 필드명을 사용하므로 변환
            Map<String, Object> body = Map.of(
                    "query", chatRequest.getQuery(),
                    "document_type", chatRequest.getDocumentType(),
                    "top_k", chatRequest.getTopK()
            );

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    llmServiceUrl + "/api/chat",
                    HttpMethod.POST,
                    requestEntity,
                    Map.class
            );

            Map<String, Object> responseBody = response.getBody();
            return (Map<String, Object>) responseBody.get("data");
        } catch (Exception e) {
            throw new RuntimeException("LLM service call failed: " + e.getMessage(), e);
        }
    }
}

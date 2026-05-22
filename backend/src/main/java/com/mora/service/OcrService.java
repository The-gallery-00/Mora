package com.mora.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Service
public class OcrService {

    private final RestTemplate restTemplate;

    @Value("${app.ocr-service-url}")
    private String ocrServiceUrl;

    public OcrService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> scan(MultipartFile file) {
        try {
            // 외부 OCR 서버로 보낼 HTTP 헤더 설정 (multipart/form-data)
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // MultipartFile → ByteArrayResource 변환 (RestTemplate이 전송할 수 있는 형태)
            // getFilename()을 오버라이드해야 파일명이 multipart 파트에 포함된다
            ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };

            // multipart 요청 바디 구성: "file" 파트에 이미지 파일 추가
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new HttpEntity<>(resource, createFileHeaders(file)));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            // Python OCR 서버의 /api/scan 엔드포인트에 POST 요청
            ResponseEntity<Map> response = restTemplate.exchange(
                    ocrServiceUrl + "/api/scan",
                    HttpMethod.POST,
                    requestEntity,
                    Map.class
            );

            return response.getBody();
        } catch (Exception e) {
            throw new RuntimeException("OCR service call failed: " + e.getMessage(), e);
        }
    }

    private HttpHeaders createFileHeaders(MultipartFile file) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                file.getContentType() != null ? file.getContentType() : "application/octet-stream"));
        return headers;
    }
}

package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.service.LlmService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "LLM", description = "자연어 질문 기반 RAG 답변 API")
@RestController
@RequestMapping("/api")
public class LlmController {

    private final LlmService llmService;

    public LlmController(LlmService llmService) {
        this.llmService = llmService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<Map<String, Object>>> chat(
            @RequestBody Map<String, Object> requestBody,
            HttpServletRequest request) {
        try {
            String authHeader = request.getHeader("Authorization");
            Map<String, Object> result = llmService.chat(requestBody, authHeader);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

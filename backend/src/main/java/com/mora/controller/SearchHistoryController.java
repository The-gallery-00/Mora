package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.search.SearchHistoryResponse;
import com.mora.security.JwtUtil;
import com.mora.service.SearchHistoryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Tag(name = "검색 기록", description = "사용자 검색 기록 API")
@RestController
@RequestMapping("/api/search-histories")
public class SearchHistoryController {

    private final SearchHistoryService searchHistoryService;
    private final JwtUtil jwtUtil;

    public SearchHistoryController(SearchHistoryService searchHistoryService, JwtUtil jwtUtil) {
        this.searchHistoryService = searchHistoryService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SearchHistoryResponse>>> list(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(searchHistoryService.list(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Long>> deleteAll(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(searchHistoryService.deleteAll(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    private UUID getUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            return jwtUtil.getUserId(header.substring(7));
        } catch (Exception e) {
            return null;
        }
    }
}

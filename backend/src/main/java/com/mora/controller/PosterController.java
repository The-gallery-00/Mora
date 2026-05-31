package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.dto.api.ServiceResult;
import com.mora.dto.poster.PosterResponse;
import com.mora.dto.poster.PosterRequest;
import com.mora.security.JwtUtil;
import com.mora.service.PosterService;
import com.mora.service.SearchHistoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "포스터", description = "포스터 관리 API")
@RestController
@RequestMapping("/api/posters")
public class PosterController {

    private final PosterService posterService;
    private final SearchHistoryService searchHistoryService;
    private final JwtUtil jwtUtil;

    public PosterController(PosterService posterService, SearchHistoryService searchHistoryService, JwtUtil jwtUtil) {
        this.posterService = posterService;
        this.searchHistoryService = searchHistoryService;
        this.jwtUtil = jwtUtil;
    }

    /*
     * Authorization 헤더에서 JWT 토큰을 추출하여 사용자 UUID를 반환한다.
     * 토큰이 없거나 유효하지 않으면 null을 반환한다.
     */
    private UUID getUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            return jwtUtil.getUserId(header.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    /*
     * OCR 인식 결과를 포스터로 저장한다.
     * (로그인 필수 — JWT 토큰에서 userId를 추출하여 포스터 소유자를 설정)
     */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse<PosterResponse>> save(
            HttpServletRequest request,
            @RequestBody PosterRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<PosterResponse> result = posterService.save(userId, body);
            ApiResponse<PosterResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 현재 사용자의 포스터 목록을 최신순으로 페이지네이션 조회한다. (로그인 필수)
     * GET /api/posters?page=0&size=10
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<PosterResponse>>> list(
            HttpServletRequest request,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(posterService.listByUser(userId, page, size)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 특정 포스터를 조회한다. (로그인 필수, 본인 소유 포스터만 조회 가능)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PosterResponse>> getById(
            HttpServletRequest request,
            @PathVariable Integer id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(posterService.findById(userId, id)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 특정 포스터의 정보를 수정한다. (로그인 필수, 본인 소유 포스터만 수정 가능)
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PosterResponse>> update(
            HttpServletRequest request,
            @PathVariable Integer id,
            @RequestBody PosterRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<PosterResponse> result = posterService.update(userId, id, body);
            ApiResponse<PosterResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 포스터를 삭제한다. (로그인 필수, 본인 소유 포스터만 삭제 가능)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            HttpServletRequest request,
            @PathVariable Integer id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            posterService.delete(userId, id);
            return ResponseEntity.ok(ApiResponse.ok(null));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 벡터 유사도 기반으로 포스터를 검색한다.
     * (검색 쿼리(q)를 임베딩으로 변환하여 코사인 유사도가 높은 포스터를 반환)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<PosterResponse>>> search(
            HttpServletRequest request,
            @RequestParam("q") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            searchHistoryService.record(userId, "POSTER", query);
            ServiceResult<List<PosterResponse>> result = posterService.hybridSearch(userId, query, topK);
            ApiResponse<List<PosterResponse>> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

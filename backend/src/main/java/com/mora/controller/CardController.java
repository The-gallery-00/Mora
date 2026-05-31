package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.dto.api.ServiceResult;
import com.mora.dto.card.CardResponse;
import com.mora.dto.card.CardRequest;
import com.mora.dto.card.CardMoveGroupRequest;
import com.mora.security.JwtUtil;
import com.mora.service.CardService;
import com.mora.service.SearchHistoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.UUID;

@Tag(name = "명함", description = "명함 관리 API")
@RestController
@RequestMapping("/api/cards")
public class CardController {

    private final CardService cardService;
    private final SearchHistoryService searchHistoryService;
    private final JwtUtil jwtUtil;

    public CardController(CardService cardService, SearchHistoryService searchHistoryService, JwtUtil jwtUtil) {
        this.cardService = cardService;
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
            return jwtUtil.getUserId(header.substring(7));  // "Bearer " 제거 후 파싱
        } catch (Exception e) {
            return null;
        }
    }

    /*
     * OCR 인식 결과를 명함으로 저장한다.
     * (로그인 필수 — JWT 토큰에서 userId를 추출하여 명함 소유자를 설정)
     */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse<CardResponse>> save(
            HttpServletRequest request,
            @RequestBody CardRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<CardResponse> result = cardService.save(userId, body);
            ApiResponse<CardResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 현재 사용자의 명함 목록을 최신순으로 페이지네이션 조회한다. (로그인 필수)
     * GET /api/cards?page=0&size=10
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<CardResponse>>> list(
            HttpServletRequest request,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "groupId", required = false) UUID groupId,
            @RequestParam(value = "ungrouped", defaultValue = "false") boolean ungrouped) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            Page<CardResponse> cards = cardService.listByUser(userId, page, size, groupId, ungrouped);
            return ResponseEntity.ok(ApiResponse.ok(cards));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 특정 명함을 조회한다. (로그인 필수, 본인 소유 명함만 조회 가능)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CardResponse>> getById(
            HttpServletRequest request,
            @PathVariable UUID id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            CardResponse response = cardService.findById(userId, id);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 특정 명함의 정보를 수정한다. (로그인 필수, 본인 소유 명함만 수정 가능)
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CardResponse>> update(
            HttpServletRequest request,
            @PathVariable UUID id,
            @RequestBody CardRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<CardResponse> result = cardService.update(userId, id, body);
            ApiResponse<CardResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 명함을 삭제한다. (로그인 필수, 본인 소유 명함만 삭제 가능)
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(HttpServletRequest request, @PathVariable UUID id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            cardService.delete(userId, id);
            return ResponseEntity.ok(ApiResponse.ok(null));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 명함을 특정 그룹으로 이동한다. groupId가 null이면 미분류로 이동한다.
     */
    @PatchMapping("/{id}/group")
    public ResponseEntity<ApiResponse<CardResponse>> moveGroup(
            HttpServletRequest request,
            @PathVariable UUID id,
            @RequestBody(required = false) CardMoveGroupRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            UUID groupId = body == null ? null : body.getGroupId();
            return ResponseEntity.ok(ApiResponse.ok(cardService.moveGroup(userId, id, groupId)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 벡터 유사도 기반으로 명함을 검색한다.
     * (검색 쿼리(q)를 임베딩으로 변환하여 코사인 유사도가 높은 명함을 반환)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<CardResponse>>> search(
            HttpServletRequest request,
            @RequestParam("q") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            searchHistoryService.record(userId, "BUSINESS_CARD", query);
            ServiceResult<List<CardResponse>> result = cardService.hybridSearch(userId, query, topK);
            ApiResponse<List<CardResponse>> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

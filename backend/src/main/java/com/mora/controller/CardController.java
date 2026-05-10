package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.card.CardResponse;
import com.mora.dto.card.CardSaveRequest;
import com.mora.security.JwtUtil;
import com.mora.service.CardService;
import com.mora.service.OcrService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CardController {

    private final CardService cardService;
    private final OcrService ocrService;
    private final JwtUtil jwtUtil;

    public CardController(CardService cardService, OcrService ocrService, JwtUtil jwtUtil) {
        this.cardService = cardService;
        this.ocrService = ocrService;
        this.jwtUtil = jwtUtil;
    }

    /**
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

    /**
     * 명함 이미지를 OCR 서버에 보내 문자 인식을 수행한다.
     * 인증 불필요 — 비회원도 OCR 스캔 가능.
     */
    @PostMapping("/scan")
    public ResponseEntity<ApiResponse<Map<String, Object>>> scan(@RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> result = ocrService.scan(file);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * OCR 인식 결과를 명함으로 저장한다.
     * 로그인 필수 — JWT 토큰에서 userId를 추출하여 명함 소유자를 설정한다.
     */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse<CardResponse>> save(
            HttpServletRequest request,
            @RequestBody CardSaveRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            CardResponse response = cardService.save(userId, body);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 현재 사용자의 명함 목록을 최신순으로 조회한다.
     * 로그인 필수.
     */
    @GetMapping("/cards")
    public ResponseEntity<ApiResponse<List<CardResponse>>> list(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            List<CardResponse> cards = cardService.listByUser(userId);
            return ResponseEntity.ok(ApiResponse.ok(cards));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 특정 명함의 정보를 수정한다.
     * 로그인 필수. 본인 소유 명함만 수정 가능.
     */
    @PutMapping("/cards/{id}")
    public ResponseEntity<ApiResponse<CardResponse>> update(
            HttpServletRequest request,
            @PathVariable UUID id,
            @RequestBody CardSaveRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            CardResponse response = cardService.update(userId, id, body);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 특정 명함을 삭제한다.
     * 로그인 필수. 본인 소유 명함만 삭제 가능.
     */
    @DeleteMapping("/cards/{id}")
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

    /**
     * 벡터 유사도 기반으로 명함을 검색한다.
     * 검색 쿼리(q)를 임베딩으로 변환하여 코사인 유사도가 높은 명함을 반환한다.
     * 로그인 필수.
     *
     * @param query 검색 키워드 (예: "삼성전자 개발자")
     * @param topK  반환할 최대 결과 수 (기본값: 5)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<CardResponse>>> search(
            HttpServletRequest request,
            @RequestParam("q") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            List<CardResponse> results = cardService.search(userId, query, topK);
            return ResponseEntity.ok(ApiResponse.ok(results));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

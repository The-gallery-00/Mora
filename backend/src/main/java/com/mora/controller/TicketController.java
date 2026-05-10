package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.ticket.TicketResponse;
import com.mora.dto.ticket.TicketSaveRequest;
import com.mora.security.JwtUtil;
import com.mora.service.TicketService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * ═══════════════════════════════════════════════════════════════
 * TicketController — 티켓 관련 REST API 컨트롤러
 * ═══════════════════════════════════════════════════════════════
 *
 * [역할]
 * 티켓 저장, 단건 조회, 목록 조회, 수정, 삭제, 하이브리드 검색 등
 * 티켓 관리의 모든 HTTP 엔드포인트를 제공하는 컨트롤러이다.
 * 모든 엔드포인트는 JWT 인증을 필요로 한다.
 *
 * [API 목록]
 * ───────────────────────────────────────────────────────────
 * POST   /api/tickets/save              — 티켓 저장
 * GET    /api/tickets                   — 목록 조회 (페이지네이션)
 * GET    /api/tickets/{id}              — 단건 조회
 * PUT    /api/tickets/{id}              — 수정
 * DELETE /api/tickets/{id}              — 삭제
 * GET    /api/tickets/search?q=...&topK=5 — 하이브리드 검색
 * ───────────────────────────────────────────────────────────
 *
 * [코드 흐름]
 * 1) 저장 (POST /api/tickets/save):
 *    → JWT 인증 → TicketSaveRequest 수신 → TicketService.save() 호출
 * 2) 목록 조회 (GET /api/tickets):
 *    → JWT 인증 → page/size 파라미터 수신 → TicketService.listByUser() 호출
 * 3) 단건 조회 (GET /api/tickets/{id}):
 *    → JWT 인증 → TicketService.findById() 호출 (소유자 확인 포함)
 * 4) 수정 (PUT /api/tickets/{id}):
 *    → JWT 인증 → TicketSaveRequest 수신 → TicketService.update() 호출
 * 5) 삭제 (DELETE /api/tickets/{id}):
 *    → JWT 인증 → TicketService.delete() 호출
 * 6) 하이브리드 검색 (GET /api/tickets/search):
 *    → JWT 인증 → q/topK 파라미터 → TicketService.hybridSearch() 호출
 *    → Fuzzy(pg_trgm) + Vector(pgvector) 결과를 60:40 가중 합산하여 반환
 *
 * [페이지네이션 응답 형식]
 * Spring Page 객체가 JSON으로 직렬화되어 아래 형식으로 반환된다:
 * {
 *   "success": true,
 *   "data": {
 *     "content": [...],          ← 티켓 목록
 *     "totalElements": 42,       ← 전체 티켓 수
 *     "totalPages": 5,           ← 전체 페이지 수
 *     "number": 0,               ← 현재 페이지 (0부터)
 *     "size": 10                 ← 페이지 크기
 *   }
 * }
 *
 */
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;
    private final JwtUtil jwtUtil;

    public TicketController(TicketService ticketService, JwtUtil jwtUtil) {
        this.ticketService = ticketService;
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
     * 티켓을 저장한다.
     * 프론트엔드가 OCR 결과를 사용자에게 보여주고, 사용자가 확인/수정 후 저장 시 호출된다.
     * rawText 배열을 공백 JOIN하고, OpenAI 임베딩을 생성하여 함께 저장한다.
     *
     * POST /api/tickets/save
     */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse<TicketResponse>> save(
            HttpServletRequest request,
            @RequestBody TicketSaveRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            TicketResponse response = ticketService.save(userId, body);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 현재 사용자의 티켓 목록을 최신순으로 페이지네이션 조회한다.
     *
     * GET /api/tickets?page=0&size=10
     *
     * @param page 페이지 번호 (기본값: 0, 0부터 시작)
     * @param size 페이지당 항목 수 (기본값: 10)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<TicketResponse>>> list(
            HttpServletRequest request,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            Page<TicketResponse> tickets = ticketService.listByUser(userId, page, size);
            return ResponseEntity.ok(ApiResponse.ok(tickets));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 특정 티켓을 단건 조회한다.
     * 본인 소유 티켓만 조회 가능하다.
     *
     * GET /api/tickets/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> getById(
            HttpServletRequest request,
            @PathVariable Integer id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            TicketResponse response = ticketService.findById(userId, id);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 특정 티켓의 정보를 수정한다.
     * 본인 소유 티켓만 수정 가능하다.
     * rawText가 포함된 경우 임베딩도 재생성한다.
     *
     * PUT /api/tickets/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> update(
            HttpServletRequest request,
            @PathVariable Integer id,
            @RequestBody TicketSaveRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            TicketResponse response = ticketService.update(userId, id, body);
            return ResponseEntity.ok(ApiResponse.ok(response));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 특정 티켓을 삭제한다.
     * 본인 소유 티켓만 삭제 가능하다.
     *
     * DELETE /api/tickets/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            HttpServletRequest request,
            @PathVariable Integer id) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ticketService.delete(userId, id);
            return ResponseEntity.ok(ApiResponse.ok(null));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /**
     * 하이브리드 검색 (pg_trgm Fuzzy + pgvector Vector)을 수행한다.
     *
     * [검색 방식]
     * - Fuzzy: pg_trgm 오타 허용 검색 (동적 임계값 1.0→0.6)
     * - Vector: OpenAI 임베딩 기반 의미 유사도 검색
     * - 최종 점수 = Fuzzy점수 × 60% + Vector점수 × 40%
     *
     * GET /api/tickets/search?q=검색어&topK=5
     *
     * @param query 검색 키워드 (예: "서울 부산 KTX")
     * @param topK  반환할 최대 결과 수 (기본값: 5)
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<TicketResponse>>> search(
            HttpServletRequest request,
            @RequestParam("q") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            List<TicketResponse> results = ticketService.hybridSearch(userId, query, topK);
            return ResponseEntity.ok(ApiResponse.ok(results));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.dto.api.ServiceResult;
import com.mora.dto.ticket.TicketResponse;
import com.mora.dto.ticket.TicketRequest;
import com.mora.security.JwtUtil;
import com.mora.service.SearchHistoryService;
import com.mora.service.TicketService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "티켓", description = "티켓 관리 API")
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;
    private final SearchHistoryService searchHistoryService;
    private final JwtUtil jwtUtil;

    public TicketController(TicketService ticketService, SearchHistoryService searchHistoryService, JwtUtil jwtUtil) {
        this.ticketService = ticketService;
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
     * 티켓을 저장한다.
     * 프론트엔드가 OCR 결과를 사용자에게 보여주고, 사용자가 확인/수정 후 저장 시 호출된다.
     * rawText 배열을 공백 JOIN하고, OpenAI 임베딩을 생성하여 함께 저장한다.
     * POST /api/tickets/save
     */
    @PostMapping("/save")
    public ResponseEntity<ApiResponse<TicketResponse>> save(
            HttpServletRequest request,
            @RequestBody TicketRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<TicketResponse> result = ticketService.save(userId, body);
            ApiResponse<TicketResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 현재 사용자의 티켓 목록을 최신순으로 페이지네이션 조회한다.
     * GET /api/tickets?page=0&size=10
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

    /*
     * 특정 티켓을 조회한다.(본인 소유 티켓만 조회 가능)
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

    /*
     * 특정 티켓의 정보를 수정한다. (본인 소유 티켓만 수정 가능)
     * rawText가 포함된 경우 임베딩도 재생성한다.
     * PUT /api/tickets/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TicketResponse>> update(
            HttpServletRequest request,
            @PathVariable Integer id,
            @RequestBody TicketRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            ServiceResult<TicketResponse> result = ticketService.update(userId, id, body);
            ApiResponse<TicketResponse> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    /*
     * 특정 티켓을 삭제한다.(본인 소유 티켓만 삭제 가능)
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

    /*
     * 하이브리드 검색 (pg_trgm Fuzzy + pgvector Vector)을 수행한다.
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<TicketResponse>>> search(
            HttpServletRequest request,
            @RequestParam("q") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            searchHistoryService.record(userId, "TICKET", query);
            ServiceResult<List<TicketResponse>> result = ticketService.hybridSearch(userId, query, topK);
            ApiResponse<List<TicketResponse>> apiResponse = ApiResponse.ok(result.getData());
            if (result.hasMessage()) apiResponse.setMessage(result.getMessage());
            return ResponseEntity.ok(apiResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }
}

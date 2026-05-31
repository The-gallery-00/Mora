package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.card.CardGroupRequest;
import com.mora.dto.card.CardGroupResponse;
import com.mora.security.JwtUtil;
import com.mora.service.CardGroupService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "명함 그룹", description = "명함 그룹 관리 API")
@RestController
@RequestMapping("/api/card-groups")
public class CardGroupController {

    private final CardGroupService cardGroupService;
    private final JwtUtil jwtUtil;

    public CardGroupController(CardGroupService cardGroupService, JwtUtil jwtUtil) {
        this.cardGroupService = cardGroupService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CardGroupResponse>>> list(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(cardGroupService.list(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CardGroupResponse>> create(HttpServletRequest request,
                                                                 @RequestBody CardGroupRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(cardGroupService.create(userId, body)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PatchMapping("/{groupId}")
    public ResponseEntity<ApiResponse<CardGroupResponse>> update(HttpServletRequest request,
                                                                 @PathVariable UUID groupId,
                                                                 @RequestBody CardGroupRequest body) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(cardGroupService.update(userId, groupId, body)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<ApiResponse<Void>> delete(HttpServletRequest request,
                                                    @PathVariable UUID groupId) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            cardGroupService.delete(userId, groupId);
            return ResponseEntity.ok(ApiResponse.ok(null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
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

package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.data.UserDataDeleteResponse;
import com.mora.security.JwtUtil;
import com.mora.service.UserDataService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "사용자 데이터", description = "사용자 데이터 관리 API")
@RestController
@RequestMapping("/api/me")
public class UserDataController {

    private final UserDataService userDataService;
    private final JwtUtil jwtUtil;

    public UserDataController(UserDataService userDataService, JwtUtil jwtUtil) {
        this.userDataService = userDataService;
        this.jwtUtil = jwtUtil;
    }

    @DeleteMapping("/documents")
    public ResponseEntity<ApiResponse<UserDataDeleteResponse>> deleteDocuments(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(userDataService.deleteAllDocuments(userId)));
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

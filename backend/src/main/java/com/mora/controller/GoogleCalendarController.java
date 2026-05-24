package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.dto.calendar.GoogleCalendarConnectedResponse;
import com.mora.dto.calendar.GoogleCalendarConnectUrlResponse;
import com.mora.dto.calendar.GoogleCalendarMonthResponse;
import com.mora.dto.calendar.GoogleCalendarTokenResponse;
import com.mora.entity.GoogleCalendarToken;
import com.mora.entity.user.User;
import com.mora.security.JwtUtil;
import com.mora.service.AuthService;
import com.mora.service.GoogleCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "구글 캘린더", description = "구글 캘린더 연동 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/google-calendar")
public class GoogleCalendarController {

    private final GoogleCalendarService googleCalendarService;
    private final AuthService authService;
    private final JwtUtil jwtUtil;

    @GetMapping("/connect-url")
    public ResponseEntity<ApiResponse<GoogleCalendarConnectUrlResponse>> getConnectUrl(
            @RequestParam(required = false) UUID userId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        try {
            User user = authService.getUserById(resolveUserId(userId, authorization));
            String url = googleCalendarService.getAuthorizationUrl(user);
            return ResponseEntity.ok(ApiResponse.ok(new GoogleCalendarConnectUrlResponse(url)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping("/callback")
    public ResponseEntity<ApiResponse<GoogleCalendarTokenResponse>> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error
    ) {
        try {
            if (error != null && !error.isBlank()) {
                throw new RuntimeException("구글 캘린더 연동이 취소되었습니다.");
            }
            GoogleCalendarToken token = googleCalendarService.connectByCode(code, state);
            return ResponseEntity.ok(ApiResponse.ok(GoogleCalendarTokenResponse.from(token)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping("/connected/{userId}")
    public ResponseEntity<ApiResponse<GoogleCalendarConnectedResponse>> getConnected(@PathVariable UUID userId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(googleCalendarService.getConnected(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping("/tokens/{userId}")
    public ResponseEntity<ApiResponse<GoogleCalendarTokenResponse>> getTokenInfo(@PathVariable UUID userId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(googleCalendarService.getTokenInfo(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @DeleteMapping("/tokens/{userId}")
    public ResponseEntity<ApiResponse<GoogleCalendarConnectedResponse>> disconnect(@PathVariable UUID userId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(googleCalendarService.disconnect(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping("/month")
    public ResponseEntity<ApiResponse<GoogleCalendarMonthResponse>> getMonth(
            @RequestParam UUID userId,
            @RequestParam int year,
            @RequestParam int month
    ) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(googleCalendarService.getMonth(userId, year, month)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    private UUID resolveUserId(UUID userId, String authorization) {
        UUID authenticatedUserId = getAuthenticatedUserId();
        if (authenticatedUserId != null) {
            return authenticatedUserId;
        }
        UUID headerUserId = getUserIdFromHeader(authorization);
        if (headerUserId != null) {
            return headerUserId;
        }
        if (userId != null) {
            return userId;
        }
        throw new RuntimeException("사용자 ID가 필요합니다.");
    }

    private UUID getAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UUID userId)) {
            return null;
        }
        return userId;
    }

    private UUID getUserIdFromHeader(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String token = authorization.substring(7);
        if (!jwtUtil.isValid(token)) {
            throw new RuntimeException("로그인 토큰이 올바르지 않습니다.");
        }
        return jwtUtil.getUserId(token);
    }
}

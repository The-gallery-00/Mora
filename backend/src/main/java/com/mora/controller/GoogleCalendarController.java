package com.mora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import com.mora.dto.api.ApiResponse;
import com.mora.entity.GoogleCalendarToken;
import com.mora.entity.user.User;
import com.mora.security.JwtUtil;
import com.mora.service.AuthService;
import com.mora.service.GoogleCalendarService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@Tag(name = "구글 캘린더", description = "구글 캘린더 연동 API")
@RestController
@RequestMapping("/api/calendar/google")
public class GoogleCalendarController {

    private final GoogleCalendarService googleCalendarService;
    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final String frontendUrl;

    public GoogleCalendarController(GoogleCalendarService googleCalendarService,
                                    AuthService authService,
                                    JwtUtil jwtUtil,
                                    @Value("${app.frontend-url}") String frontendUrl) {
        this.googleCalendarService = googleCalendarService;
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.frontendUrl = normalizeFrontendUrl(frontendUrl);
    }

    @GetMapping("/connect")
    public ResponseEntity<?> connect(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
                                     @RequestParam(required = false) String token) {
        try {
            User user = resolveUser(authorization, token);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, googleCalendarService.getAuthorizationUrl(user))
                    .build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping(value = "/callback", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> callback(@RequestParam(required = false) String code,
                                           @RequestParam(required = false) String state,
                                           @RequestParam(required = false) String error) {
        try {
            if (error != null && !error.isBlank()) {
                return buildHtmlResponse(HttpStatus.BAD_REQUEST, buildFailureHtml(error));
            }

            GoogleCalendarToken token = googleCalendarService.connectByCode(code, state);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header(HttpHeaders.LOCATION, frontendUrl + "/dashboard/settings?calendar=connected&email=" + urlEncode(token.getGoogleEmail()))
                    .build();
        } catch (RuntimeException e) {
            return buildHtmlResponse(HttpStatus.BAD_REQUEST, buildFailureHtml(e.getMessage()));
        }
    }

    private User resolveUser(String authorization, String token) {
        String rawToken = token;
        if ((rawToken == null || rawToken.isBlank()) && authorization != null && authorization.startsWith("Bearer ")) {
            rawToken = authorization.substring(7);
        }
        if (rawToken == null || rawToken.isBlank()) {
            throw new RuntimeException("Login token is required");
        }
        if (!jwtUtil.isValid(rawToken)) {
            throw new RuntimeException("Invalid login token");
        }
        return authService.getUserById(jwtUtil.getUserId(rawToken));
    }

    private ResponseEntity<String> buildHtmlResponse(HttpStatus status, String html) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        return new ResponseEntity<>(html, headers, status);
    }

    private String buildFailureHtml(String message) {
        return """
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8" />
                    <title>MORA Calendar Connect Failed</title>
                </head>
                <body style="font-family: sans-serif; padding: 32px;">
                    <h2>구글 캘린더 연동에 실패했습니다.</h2>
                    <p>%s</p>
                    <p>브라우저를 닫고 다시 시도해 주세요.</p>
                </body>
                </html>
                """.formatted(escapeHtml(message == null ? "Calendar connect failed" : message));
    }

    private String normalizeFrontendUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("/+$", "");
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String urlEncode(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}

package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.notification.NotificationSettingRequest;
import com.mora.dto.notification.NotificationSettingResponse;
import com.mora.security.JwtUtil;
import com.mora.service.NotificationSettingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Notification Settings", description = "Notification setting API")
@RestController
@RequestMapping("/api/notification-settings")
public class NotificationSettingController {

    private final NotificationSettingService notificationSettingService;
    private final JwtUtil jwtUtil;

    public NotificationSettingController(NotificationSettingService notificationSettingService, JwtUtil jwtUtil) {
        this.notificationSettingService = notificationSettingService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<NotificationSettingResponse>> get(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationSettingService.get(userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<ApiResponse<NotificationSettingResponse>> update(
            HttpServletRequest request,
            @RequestBody NotificationSettingRequest settingRequest) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationSettingService.update(userId, settingRequest)));
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

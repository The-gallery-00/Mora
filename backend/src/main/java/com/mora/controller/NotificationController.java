package com.mora.controller;

import com.mora.dto.api.ApiResponse;
import com.mora.dto.notification.NotificationRequest;
import com.mora.dto.notification.NotificationResponse;
import com.mora.security.JwtUtil;
import com.mora.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@Tag(name = "Notifications", description = "In-app notification API")
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final JwtUtil jwtUtil;

    public NotificationController(NotificationService notificationService, JwtUtil jwtUtil) {
        this.notificationService = notificationService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<NotificationResponse>>> list(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationService.list(userId, page, size)));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> unreadCount(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(Map.of("count", notificationService.countUnread(userId))));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<ApiResponse<NotificationResponse>> create(
            HttpServletRequest request,
            @RequestBody NotificationRequest notificationRequest) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationService.create(userId, notificationRequest)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(
            HttpServletRequest request,
            @PathVariable UUID notificationId) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationService.markAsRead(userId, notificationId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Map<String, Long>>> markAllAsRead(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(Map.of("updatedCount", notificationService.markAllAsRead(userId))));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            HttpServletRequest request,
            @PathVariable UUID notificationId) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            notificationService.delete(userId, notificationId);
            return ResponseEntity.ok(ApiResponse.ok(null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.fail(e.getMessage()));
        }
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Long>> deleteAll(HttpServletRequest request) {
        try {
            UUID userId = getUserId(request);
            if (userId == null) return ResponseEntity.status(401).body(ApiResponse.fail("Login required"));
            return ResponseEntity.ok(ApiResponse.ok(notificationService.deleteAll(userId)));
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

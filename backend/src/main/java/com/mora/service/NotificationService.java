package com.mora.service;

import com.mora.dto.notification.NotificationRequest;
import com.mora.dto.notification.NotificationResponse;
import com.mora.entity.Notification;
import com.mora.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 50;

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public Page<NotificationResponse> list(UUID userId, int page, int size) {
        validateUserId(userId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(NotificationResponse::from);
    }

    public long countUnread(UUID userId) {
        validateUserId(userId);
        return notificationRepository.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public NotificationResponse create(UUID userId, NotificationRequest request) {
        validateUserId(userId);
        validateRequest(request);

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(normalize(request.getType(), "GENERAL"));
        notification.setTitle(request.getTitle().trim());
        notification.setMessage(request.getMessage().trim());
        notification.setLinkUrl(normalize(request.getLinkUrl(), null));

        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Transactional
    public NotificationResponse markAsRead(UUID userId, UUID notificationId) {
        validateUserId(userId);
        Notification notification = findOwnedNotification(userId, notificationId);
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }
        return NotificationResponse.from(notification);
    }

    @Transactional
    public long markAllAsRead(UUID userId) {
        validateUserId(userId);
        var notifications = notificationRepository.findByUserIdAndReadAtIsNull(userId);
        LocalDateTime now = LocalDateTime.now();
        notifications.forEach(notification -> notification.setReadAt(now));
        return notifications.size();
    }

    @Transactional
    public void delete(UUID userId, UUID notificationId) {
        validateUserId(userId);
        notificationRepository.delete(findOwnedNotification(userId, notificationId));
    }

    @Transactional
    public long deleteAll(UUID userId) {
        validateUserId(userId);
        long count = notificationRepository.countByUserId(userId);
        notificationRepository.deleteByUserId(userId);
        return count;
    }

    private Notification findOwnedNotification(UUID userId, UUID notificationId) {
        if (notificationId == null) {
            throw new RuntimeException("Notification ID is required");
        }
        return notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
    }

    private void validateRequest(NotificationRequest request) {
        if (request == null || request.getTitle() == null || request.getTitle().isBlank()) {
            throw new RuntimeException("Title is required");
        }
        if (request.getMessage() == null || request.getMessage().isBlank()) {
            throw new RuntimeException("Message is required");
        }
    }

    private void validateUserId(UUID userId) {
        if (userId == null) {
            throw new RuntimeException("User ID is required");
        }
    }

    private String normalize(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}

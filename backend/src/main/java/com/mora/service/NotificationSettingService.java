package com.mora.service;

import com.mora.dto.notification.NotificationSettingRequest;
import com.mora.dto.notification.NotificationSettingResponse;
import com.mora.entity.NotificationSetting;
import com.mora.repository.NotificationSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificationSettingService {

    private static final int MIN_DEADLINE_REMINDER_DAYS = 0;
    private static final int MAX_DEADLINE_REMINDER_DAYS = 30;

    private final NotificationSettingRepository notificationSettingRepository;

    public NotificationSettingService(NotificationSettingRepository notificationSettingRepository) {
        this.notificationSettingRepository = notificationSettingRepository;
    }

    @Transactional
    public NotificationSettingResponse get(UUID userId) {
        validateUserId(userId);
        return NotificationSettingResponse.from(findOrCreate(userId));
    }

    @Transactional
    public NotificationSettingResponse update(UUID userId, NotificationSettingRequest request) {
        validateUserId(userId);
        if (request == null) {
            throw new RuntimeException("Notification setting request is required");
        }

        NotificationSetting setting = findOrCreate(userId);

        if (request.getDeadlineReminderDays() != null) {
            validateDeadlineReminderDays(request.getDeadlineReminderDays());
            setting.setDeadlineReminderDays(request.getDeadlineReminderDays());
        }
        if (request.getDeadlineReminderEnabled() != null) {
            setting.setDeadlineReminderEnabled(request.getDeadlineReminderEnabled());
        }
        if (request.getScheduleReminderEnabled() != null) {
            setting.setScheduleReminderEnabled(request.getScheduleReminderEnabled());
        }

        return NotificationSettingResponse.from(setting);
    }

    private NotificationSetting findOrCreate(UUID userId) {
        return notificationSettingRepository.findById(userId)
                .orElseGet(() -> {
                    NotificationSetting setting = new NotificationSetting();
                    setting.setUserId(userId);
                    return notificationSettingRepository.save(setting);
                });
    }

    private void validateDeadlineReminderDays(int days) {
        if (days < MIN_DEADLINE_REMINDER_DAYS || days > MAX_DEADLINE_REMINDER_DAYS) {
            throw new RuntimeException("Deadline reminder days must be between 0 and 30");
        }
    }

    private void validateUserId(UUID userId) {
        if (userId == null) {
            throw new RuntimeException("User ID is required");
        }
    }
}

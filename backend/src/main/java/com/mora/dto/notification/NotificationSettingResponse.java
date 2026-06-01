package com.mora.dto.notification;

import com.mora.entity.NotificationSetting;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class NotificationSettingResponse {

    private int deadlineReminderDays;
    private boolean deadlineReminderEnabled;
    private boolean scheduleReminderEnabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static NotificationSettingResponse from(NotificationSetting setting) {
        return new NotificationSettingResponse(
                setting.getDeadlineReminderDays(),
                setting.isDeadlineReminderEnabled(),
                setting.isScheduleReminderEnabled(),
                setting.getCreatedAt(),
                setting.getUpdatedAt()
        );
    }
}

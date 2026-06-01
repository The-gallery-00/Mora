package com.mora.dto.notification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationSettingRequest {

    private Integer deadlineReminderDays;
    private Boolean deadlineReminderEnabled;
    private Boolean scheduleReminderEnabled;
}

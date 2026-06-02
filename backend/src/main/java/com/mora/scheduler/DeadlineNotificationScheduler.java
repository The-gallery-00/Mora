package com.mora.scheduler;

import com.mora.service.DeadlineNotificationService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class DeadlineNotificationScheduler {

    private final DeadlineNotificationService deadlineNotificationService;

    public DeadlineNotificationScheduler(DeadlineNotificationService deadlineNotificationService) {
        this.deadlineNotificationService = deadlineNotificationService;
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void createDeadlineNotifications() {
        deadlineNotificationService.createDeadlineNotifications();
    }
}

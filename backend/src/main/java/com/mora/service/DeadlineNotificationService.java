package com.mora.service;

import com.mora.entity.NotificationSetting;
import com.mora.entity.Poster;
import com.mora.entity.Ticket;
import com.mora.entity.user.User;
import com.mora.repository.NotificationSettingRepository;
import com.mora.repository.PosterRepository;
import com.mora.repository.TicketRepository;
import com.mora.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class DeadlineNotificationService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final String POSTER_SOURCE_TYPE = "POSTER";
    private static final String TICKET_SOURCE_TYPE = "TICKET";

    private final UserRepository userRepository;
    private final NotificationSettingRepository notificationSettingRepository;
    private final PosterRepository posterRepository;
    private final TicketRepository ticketRepository;
    private final NotificationService notificationService;

    public DeadlineNotificationService(UserRepository userRepository,
                                       NotificationSettingRepository notificationSettingRepository,
                                       PosterRepository posterRepository,
                                       TicketRepository ticketRepository,
                                       NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationSettingRepository = notificationSettingRepository;
        this.posterRepository = posterRepository;
        this.ticketRepository = ticketRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public long createDeadlineNotifications() {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        long createdCount = 0;

        for (User user : userRepository.findAll()) {
            NotificationSetting setting = findOrCreateSetting(user.getId());
            LocalDate endDate = today.plusDays(setting.getDeadlineReminderDays());

            if (setting.isDeadlineReminderEnabled()) {
                createdCount += createPosterDeadlineNotifications(user.getId(), today, endDate);
            }
            if (setting.isScheduleReminderEnabled()) {
                createdCount += createTicketScheduleNotifications(user.getId(), today, endDate);
            }
        }

        return createdCount;
    }

    private long createPosterDeadlineNotifications(UUID userId, LocalDate today, LocalDate endDate) {
        long createdCount = 0;

        for (Poster poster : posterRepository.findDeadlines(userId, today, endDate)) {
            LocalDate deadlineDate = poster.getEventEndDate() == null ? poster.getEventStartDate() : poster.getEventEndDate();
            if (deadlineDate == null) continue;

            boolean created = notificationService.createIfNotExists(
                    userId,
                    "DEADLINE",
                    "마감 임박",
                    buildPosterMessage(poster, today, deadlineDate),
                    "/dashboard/storage/posters",
                    POSTER_SOURCE_TYPE,
                    String.valueOf(poster.getId()),
                    deadlineDate
            );
            if (created) createdCount++;
        }

        return createdCount;
    }

    private long createTicketScheduleNotifications(UUID userId, LocalDate today, LocalDate endDate) {
        long createdCount = 0;

        for (Ticket ticket : ticketRepository.findByUserIdAndDepartureDateBetweenOrderByDepartureDateAscDepartureTimeAsc(
                userId,
                today,
                endDate
        )) {
            if (ticket.getDepartureDate() == null) continue;

            boolean created = notificationService.createIfNotExists(
                    userId,
                    "SCHEDULE",
                    "일정 임박",
                    buildTicketMessage(ticket, today),
                    "/dashboard/storage/tickets",
                    TICKET_SOURCE_TYPE,
                    String.valueOf(ticket.getId()),
                    ticket.getDepartureDate()
            );
            if (created) createdCount++;
        }

        return createdCount;
    }

    private NotificationSetting findOrCreateSetting(UUID userId) {
        return notificationSettingRepository.findById(userId)
                .orElseGet(() -> {
                    NotificationSetting setting = new NotificationSetting();
                    setting.setUserId(userId);
                    return notificationSettingRepository.save(setting);
                });
    }

    private String buildPosterMessage(Poster poster, LocalDate today, LocalDate deadlineDate) {
        String title = hasText(poster.getTitle()) ? poster.getTitle() : "포스터";
        long dDay = ChronoUnit.DAYS.between(today, deadlineDate);
        return title + " 마감이 " + formatDDay(dDay) + "입니다.";
    }

    private String buildTicketMessage(Ticket ticket, LocalDate today) {
        String title = buildTicketTitle(ticket);
        long dDay = ChronoUnit.DAYS.between(today, ticket.getDepartureDate());
        return title + " 일정이 " + formatDDay(dDay) + "입니다.";
    }

    private String buildTicketTitle(Ticket ticket) {
        String departure = hasText(ticket.getDepartureLocation()) ? ticket.getDepartureLocation() : "출발지";
        String arrival = hasText(ticket.getArrivalLocation()) ? ticket.getArrivalLocation() : "도착지";
        return departure + " -> " + arrival;
    }

    private String formatDDay(long dDay) {
        if (dDay == 0) {
            return "오늘";
        }
        return dDay + "일 남았습니다";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}

package com.mora.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mora.dto.dashboard.DashboardDeadlineResponse;
import com.mora.dto.dashboard.DashboardResponse;
import com.mora.dto.dashboard.DashboardScheduleResponse;
import com.mora.entity.Poster;
import com.mora.entity.Ticket;
import com.mora.repository.BusinessCardRepository;
import com.mora.repository.PosterRepository;
import com.mora.repository.ReceiptRepository;
import com.mora.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final BusinessCardRepository cardRepository;
    private final TicketRepository ticketRepository;
    private final PosterRepository posterRepository;
    private final ReceiptRepository receiptRepository;
    private final ObjectMapper objectMapper;

    public DashboardService(BusinessCardRepository cardRepository,
                            TicketRepository ticketRepository,
                            PosterRepository posterRepository,
                            ReceiptRepository receiptRepository,
                            ObjectMapper objectMapper) {
        this.cardRepository = cardRepository;
        this.ticketRepository = ticketRepository;
        this.posterRepository = posterRepository;
        this.receiptRepository = receiptRepository;
        this.objectMapper = objectMapper;
    }

    public DashboardResponse getDashboard(UUID userId, LocalDate date, int deadlineDays) {
        LocalDate targetDate = date == null ? LocalDate.now() : date;
        int normalizedDeadlineDays = Math.max(0, deadlineDays);
        LocalDate deadlineEndDate = targetDate.plusDays(normalizedDeadlineDays);

        List<DashboardScheduleResponse> todaySchedules = buildSchedules(userId, targetDate);
        List<DashboardDeadlineResponse> upcomingDeadlines = buildDeadlines(userId, targetDate, deadlineEndDate);

        long storedDocumentCount =
                cardRepository.countByUserId(userId)
                        + ticketRepository.countByUserId(userId)
                        + posterRepository.countByUserId(userId)
                        + receiptRepository.countByUserId(userId);

        return new DashboardResponse(
                targetDate,
                normalizedDeadlineDays,
                todaySchedules.size(),
                upcomingDeadlines.size(),
                storedDocumentCount,
                upcomingDeadlines,
                todaySchedules
        );
    }

    private List<DashboardScheduleResponse> buildSchedules(UUID userId, LocalDate date) {
        List<DashboardScheduleResponse> schedules = new ArrayList<>();

        for (Ticket ticket : ticketRepository.findByUserIdAndDepartureDateOrderByDepartureTimeAsc(userId, date)) {
            schedules.add(new DashboardScheduleResponse(
                    String.valueOf(ticket.getId()),
                    "TICKET",
                    buildTicketTitle(ticket),
                    ticket.getDepartureTime() == null ? "" : ticket.getDepartureTime().toString(),
                    date.toString()
            ));
        }

        for (Poster poster : posterRepository.findSchedulesByDate(userId, date)) {
            schedules.add(new DashboardScheduleResponse(
                    String.valueOf(poster.getId()),
                    "POSTER",
                    hasText(poster.getTitle()) ? poster.getTitle() : "Event",
                    "",
                    date.toString()
            ));
        }

        schedules.sort(Comparator
                .comparing(DashboardScheduleResponse::getTime, Comparator.nullsLast(String::compareTo))
                .thenComparing(DashboardScheduleResponse::getTitle, Comparator.nullsLast(String::compareTo)));
        return schedules;
    }

    private List<DashboardDeadlineResponse> buildDeadlines(UUID userId, LocalDate startDate, LocalDate endDate) {
        List<DashboardDeadlineResponse> deadlines = new ArrayList<>();

        for (Ticket ticket : ticketRepository.findByUserIdAndDepartureDateBetweenOrderByDepartureDateAscDepartureTimeAsc(
                userId,
                startDate,
                endDate
        )) {
            if (ticket.getDepartureDate() == null) continue;
            deadlines.add(new DashboardDeadlineResponse(
                    String.valueOf(ticket.getId()),
                    "TICKET",
                    buildTicketTitle(ticket),
                    nullToEmpty(ticket.getTransportType()),
                    ticket.getDepartureDate().toString(),
                    ChronoUnit.DAYS.between(startDate, ticket.getDepartureDate()),
                    extractImageUrl(ticket.getParsedJson())
            ));
        }

        for (Poster poster : posterRepository.findDeadlines(userId, startDate, endDate)) {
            LocalDate deadlineDate = poster.getEventEndDate() == null ? poster.getEventStartDate() : poster.getEventEndDate();
            if (deadlineDate == null) continue;
            deadlines.add(new DashboardDeadlineResponse(
                    String.valueOf(poster.getId()),
                    "POSTER",
                    hasText(poster.getTitle()) ? poster.getTitle() : "Event",
                    nullToEmpty(poster.getOrganizerName()),
                    deadlineDate.toString(),
                    ChronoUnit.DAYS.between(startDate, deadlineDate),
                    extractImageUrl(poster.getParsedJson())
            ));
        }

        deadlines.sort(Comparator
                .comparingLong(DashboardDeadlineResponse::getDDay)
                .thenComparing(DashboardDeadlineResponse::getDate, Comparator.nullsLast(String::compareTo)));
        return deadlines;
    }

    private String buildTicketTitle(Ticket ticket) {
        String departure = hasText(ticket.getDepartureLocation()) ? ticket.getDepartureLocation() : "Departure";
        String arrival = hasText(ticket.getArrivalLocation()) ? ticket.getArrivalLocation() : "Arrival";
        return departure + " -> " + arrival;
    }

    private String extractImageUrl(String parsedJson) {
        if (!hasText(parsedJson)) return "";
        try {
            JsonNode node = objectMapper.readTree(parsedJson);
            JsonNode imageUrl = node.get("imageUrl");
            return imageUrl == null || imageUrl.isNull() ? "" : imageUrl.asText("");
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}

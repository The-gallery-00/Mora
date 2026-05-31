package com.mora.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDate;
import java.util.List;

@Getter
@AllArgsConstructor
public class DashboardResponse {
    private LocalDate date;
    private int deadlineDays;
    private long todayScheduleCount;
    private long upcomingDeadlineCount;
    private long storedDocumentCount;
    private List<DashboardDeadlineResponse> upcomingDeadlines;
    private List<DashboardScheduleResponse> todaySchedules;
}

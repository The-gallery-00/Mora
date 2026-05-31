package com.mora.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DashboardScheduleResponse {
    private String id;
    private String type;
    private String title;
    private String time;
    private String date;
}

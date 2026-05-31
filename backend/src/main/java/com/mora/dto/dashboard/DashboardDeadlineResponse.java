package com.mora.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DashboardDeadlineResponse {
    private String id;
    private String type;
    private String title;
    private String subtitle;
    private String date;
    private long dDay;
    private String imageUrl;
}

package com.mora.dto.calendar;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class GoogleCalendarMonthResponse {

    private UUID userId;
    private int year;
    private int month;
    private boolean connected;
    private List<Object> events;
}

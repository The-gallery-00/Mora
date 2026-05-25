package com.mora.dto.calendar;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

@Getter
@AllArgsConstructor
public class GoogleCalendarConnectedResponse {

    private UUID userId;
    private boolean connected;
}

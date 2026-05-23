package com.mora.dto.calendar;

import com.mora.entity.GoogleCalendarToken;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
public class GoogleCalendarTokenResponse {

    private UUID id;
    private UUID userId;
    private String googleEmail;
    private LocalDateTime expiresAt;
    private String scope;
    private boolean connected;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static GoogleCalendarTokenResponse from(GoogleCalendarToken token) {
        return GoogleCalendarTokenResponse.builder()
                .id(token.getId())
                .userId(token.getUserId())
                .googleEmail(token.getGoogleEmail())
                .expiresAt(token.getExpiresAt())
                .scope(token.getScope())
                .connected(true)
                .createdAt(token.getCreatedAt())
                .updatedAt(token.getUpdatedAt())
                .build();
    }
}
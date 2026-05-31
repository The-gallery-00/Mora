package com.mora.dto.notification;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationRequest {

    private String type;
    private String title;
    private String message;
    private String linkUrl;
}

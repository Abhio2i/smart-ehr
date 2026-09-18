package com.healthcare.epcr.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {
    private String id;
    private String recipientId;
    private String type;
    private String title;
    private String message;
    private String relatedEntityId;
    private String relatedEntityType;
    private Boolean read;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}



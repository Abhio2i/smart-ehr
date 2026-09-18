package com.healthcare.epcr.notification.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    @Id
    private String id;
    private String recipientId;
    private String type; // INFO, WARNING, ERROR, SUCCESS
    private String title;
    private String message;
    private String relatedEntityId;
    private String relatedEntityType;
    private Boolean read;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}



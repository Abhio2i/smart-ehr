package com.healthcare.epcr.idempotency.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "idempotency_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IdempotencyRequest {
    @Id
    private String id;
    private String userId;
    private String idempotencyKey;
    private String operation;
    private String status;
    private String resourceId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditEntry {
    private LocalDateTime timestamp;
    private String performedBy;
    private String performedByName;
    private String action;
    private String fieldChanged;
    private String previousValue;
    private String newValue;
    private String ipAddress;
    private String notes;
}

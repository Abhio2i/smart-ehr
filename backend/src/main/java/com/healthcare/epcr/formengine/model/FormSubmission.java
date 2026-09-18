package com.healthcare.epcr.formengine.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "form_submissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FormSubmission {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    @Indexed
    private String templateId;
    private Integer templateVersion;
    private String submittedBy;
    private String sourceRecordId;
    private Map<String, Object> payload;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

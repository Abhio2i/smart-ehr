package com.healthcare.epcr.formengine.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "form_templates")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FormTemplate {
    @Id
    private String id;
    private String name;
    @Indexed
    private String organizationId;
    @Indexed
    private String templateType; // EPCR, QA_CHECKLIST
    private Integer version;
    private Boolean published;
    private Boolean active;
    private Map<String, Object> schema;
    private Map<String, Object> layout;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

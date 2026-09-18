package com.healthcare.epcr.retention.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "retention_folders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetentionFolder {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    private String folderName;

    /** Hierarchy: link to parent folder. Null if root directory */
    @Indexed
    private String parentFolderId;

    /** Linked policy: inherits from parent if null */
    private String retentionRuleId;

    private Instant createdAt;
    private String createdBy;
}

package com.healthcare.epcr.tb.model;

import com.healthcare.epcr.tb.enums.DotStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "tb_dot_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TbDotLog {

    @Id
    private String id;

    @Indexed
    private String caseId;

    @Indexed
    private String organizationId;

    @Indexed
    private LocalDate logDate;

    private DotStatus status;
    private String recordedBy;
    private String recordedByName;
    private String notes;
    private Instant createdAt;
}

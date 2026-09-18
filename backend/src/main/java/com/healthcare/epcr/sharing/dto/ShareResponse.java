package com.healthcare.epcr.sharing.dto;

import com.healthcare.epcr.sharing.enums.ShareStatus;
import com.healthcare.epcr.sharing.enums.ShareType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareResponse {
    private String id;
    private String recordId;
    private String patientId;
    private String organizationId;
    private String organizationName;

    private String sharedByName;
    private ShareType shareType;
    private ShareStatus status;

    private String specialistName;
    private String specialistEmail;   // omitted/masked for non-owners in the controller
    private String specialtyRequested;

    private boolean includeFullEpcr;
    private List<String> includedDocumentIds;
    private List<String> includedLabResultIds;

    private String clinicalQuestion;
    private String responseNotes;

    private Object epcrRecord;

    private Instant expiresAt;
    private Instant viewedAt;
    private Instant createdAt;
}

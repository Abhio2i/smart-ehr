package com.healthcare.epcr.sharing.dto;

import com.healthcare.epcr.sharing.enums.ShareType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateShareRequest {

    @NotNull
    private ShareType shareType;

    // INTERNAL only
    private String specialistUserId;

    // EXTERNAL only
    private String specialistEmail;
    private String specialistName;
    private String specialistOrganizationName;

    private String specialtyRequested;

    private boolean includeFullEpcr = true;
    private boolean includeVitalsHistory = false;
    private List<String> includedDocumentIds;
    private List<String> includedLabResultIds;

    private String clinicalQuestion;
    private String linkedAmbulatoryReferralId;

    // EXTERNAL only — defaults to 72h if not provided
    private Integer expiryHours;
}

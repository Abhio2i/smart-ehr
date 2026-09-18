package com.healthcare.epcr.billing.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchSubmissionRequest {
    private List<String> claimIds;
}

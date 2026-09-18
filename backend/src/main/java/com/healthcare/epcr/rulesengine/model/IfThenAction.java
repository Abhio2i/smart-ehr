package com.healthcare.epcr.rulesengine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IfThenAction {
    private String type; // EMAIL, NOTIFY, FLAG, FULL_BODY_CHECKUP
    private String to;
    private List<String> toEmails;
    private Boolean sendToPatient;
    private List<String> recipientRoles;
    private String subject;
    private String body;
    private String title;
    private String message;
    private String severity;
    private String checkupType; // For FULL_BODY_CHECKUP: STANDARD, PREMIUM, CARDIAC, etc.
    private String checkupSchedule; // For FULL_BODY_CHECKUP: ASAP, WITHIN_7_DAYS, WITHIN_30_DAYS
    private Map<String, Object> metadata;
}


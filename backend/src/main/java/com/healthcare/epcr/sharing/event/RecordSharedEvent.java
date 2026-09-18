package com.healthcare.epcr.sharing.event;

import com.healthcare.epcr.sharing.enums.ShareType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Published to topic "record-share-events" whenever a share is created,
 * viewed, revoked, or responded to. Consumers: email/SMS notifier,
 * WebSocket notification writer, audit trail, analytics.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecordSharedEvent {
    private String shareId;
    private String recordId;
    private String patientId;
    private String organizationId;
    private ShareType shareType;
    private String eventType;       // CREATED | VIEWED | RESPONDED | REVOKED | EXPIRED
    private String sharedByUserId;
    private String sharedByName;
    private String specialistUserId;   // null for EXTERNAL
    private String specialistEmail;    // null for INTERNAL (still PHI — handle with care downstream)
    private String plainAccessToken;   // ONLY present on CREATED for EXTERNAL; never persisted, used once by the email consumer
    private String rawShareLink;       // pre-built link for the email template
}

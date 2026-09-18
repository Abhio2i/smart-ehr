package com.healthcare.epcr.waitlist.dto;

import lombok.Data;

import java.util.List;

/** Paginated result of the waiting queue for a facility + serviceType. */
@Data
public class WaitlistQueueResponse {
    private String facilityId;
    private String serviceType;
    private int totalWaiting;
    private List<WaitlistQueueEntry> entries;
}

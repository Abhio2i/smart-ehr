package com.healthcare.epcr.sharing.enums;

public enum ShareType {
    INTERNAL,   // specialist already has a MedEPCR account (same or different org)
    EXTERNAL    // specialist has no account, accesses via a tokenized link
}

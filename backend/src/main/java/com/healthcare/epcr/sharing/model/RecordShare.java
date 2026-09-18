package com.healthcare.epcr.sharing.model;

import com.healthcare.epcr.sharing.enums.ShareStatus;
import com.healthcare.epcr.sharing.enums.ShareType;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Represents a single act of sharing an ePCR record (and optionally selected
 * lab results / documents) with a specialist, either internal (has a
 * MedEPCR account) or external (accesses via a tokenized link).
 *
 * PHI fields (specialistEmail, specialistName, clinicalQuestion) are
 * encrypted at rest via PhiCryptoService before persistence.
 */
@Data
@Document(collection = "record_shares")
@CompoundIndexes({
        @CompoundIndex(name = "org_record_idx", def = "{'organizationId': 1, 'recordId': 1}"),
        @CompoundIndex(name = "org_specialist_idx", def = "{'organizationId': 1, 'specialistUserId': 1, 'status': 1}")
})
public class RecordShare {

    @Id
    private String id;

    private String organizationId;   // sharing org — required for tenant scoping
    private String recordId;         // ePCR record being shared
    private String patientId;

    private String sharedByUserId;
    private String sharedByName;

    private ShareType shareType;
    private ShareStatus status;

    // -- Internal recipient --
    private String specialistUserId;       // set when shareType == INTERNAL
    private String specialistOrganizationId;

    // -- External recipient (PHI-encrypted) --
    private String specialistEmail;
    private String specialistName;
    private String specialistOrganizationName;
    private String accessTokenHash;        // sha-256 hash; plaintext token never stored

    private String specialtyRequested;     // reuse AmbulatorySpecialty enum values

    // -- Scope of what was shared --
    private boolean includeFullEpcr;
    private boolean includeVitalsHistory;
    private List<String> includedDocumentIds;
    private List<String> includedLabResultIds;

    private String clinicalQuestion;       // PHI-encrypted
    private String responseNotes;          // PHI-encrypted, filled in by specialist

    private String linkedAmbulatoryReferralId; // optional link to a formal referral
    private String linkedDisclosureId;         // HIPAA disclosure record created for this share

    private Instant expiresAt;
    private Instant viewedAt;
    private Instant respondedAt;
    private Instant revokedAt;
    private String revokedByUserId;

    @Version
    private Long version;

    private Instant createdAt;
    private Instant updatedAt;
}

package com.healthcare.epcr.security.session.cache;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CachedAuthSession implements Serializable {
    private String userId;
    private String email;
    private String organizationId;
    private String role;
    private String patientId;
    private Boolean active;
    private Long expiresAtEpochMillis;
}

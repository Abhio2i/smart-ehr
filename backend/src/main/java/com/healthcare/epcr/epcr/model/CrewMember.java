package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CrewMember {
    private String paramedicsId;
    private String name;
    private String role;
    private String certificationLevel;
    private String certificationNumber;
    private String certificationExpiryDate;
    private Boolean primaryClinician;
}

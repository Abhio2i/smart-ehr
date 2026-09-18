package com.healthcare.epcr.organization.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationDTO {
    private String id;
    private String name;
    private String code;
    private String description;
    private String address;
    private String city;
    private String state;
    private String zipCode;
    private String phone;
    private String email;
    private String contactPerson;
    private String licenseNumber;
    private Boolean orngeAuthority;
    private Boolean contractedProvider;
    private Boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}



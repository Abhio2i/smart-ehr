package com.healthcare.epcr.organization.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrganizationRequest {

    @NotBlank(message = "Organization name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @NotBlank(message = "Organization code is required")
    @Size(min = 2, max = 20, message = "Code must be between 2 and 20 characters")
    private String code;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    @Size(max = 200, message = "Address must not exceed 200 characters")
    private String address;

    @Size(max = 100, message = "City must not exceed 100 characters")
    private String city;

    @Size(max = 100, message = "State must not exceed 100 characters")
    private String state;

    @Pattern(regexp = "^[1-9][0-9]{5}$|^$", message = "Zip code must be a valid Indian PIN code")
    private String zipCode;

    @Pattern(regexp = "^[+]?[0-9]{10,}$|^$", message = "Phone must be at least 10 digits if provided")
    private String phone;

    @Email(message = "Email should be valid")
    private String email;

    @Size(max = 100, message = "Contact person name must not exceed 100 characters")
    private String contactPerson;

    @Size(max = 50, message = "License number must not exceed 50 characters")
    private String licenseNumber;

    private Boolean orngeAuthority;

    private Boolean contractedProvider;
}



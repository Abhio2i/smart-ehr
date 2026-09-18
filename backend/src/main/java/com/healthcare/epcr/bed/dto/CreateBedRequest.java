package com.healthcare.epcr.bed.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for creating a new hospital bed.
 * All fields are required to ensure data integrity.
 */
@Data
public class CreateBedRequest {

    @NotBlank(message = "Bed number is required")
    private String bedNumber;

    @NotBlank(message = "Room number is required")
    private String roomNumber;

    @NotBlank(message = "Ward name is required")
    private String wardName;

    @NotBlank(message = "Facility name is required")
    private String facilityName;
}

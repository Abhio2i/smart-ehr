package com.healthcare.epcr.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateSignaturePinRequest {
    @NotBlank(message = "Current password is required")
    private String currentPassword;

    @NotBlank(message = "New 4-digit PIN is required")
    private String newPin;
}

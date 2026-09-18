package com.healthcare.epcr.patient.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DefaultOtpDeliveryService implements OtpDeliveryService {
    private final EmailOtpDeliveryService emailOtpDeliveryService;
    private final SmsOtpDeliveryService smsOtpDeliveryService;

    @Override
    public void sendOtp(String identifier, String otp) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Email or phone is required");
        }
        String normalized = identifier.trim();
        if (normalized.contains("@")) {
            emailOtpDeliveryService.sendOtp(normalized, otp);
            return;
        }
        smsOtpDeliveryService.sendOtp(normalized, otp);
    }
}

package com.healthcare.epcr.patient.service;

import com.healthcare.epcr.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailOtpDeliveryService {
    private final EmailService emailService;

    @Value("${otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    public void sendOtp(String email, String otp) {
        try {
            String html = "<h2>Your OTP is: " + otp + "</h2>"
                    + "<p>This OTP expires in " + otpExpiryMinutes + " minutes.</p>";
            emailService.sendEmail(email, "Your Patient Login OTP", html);
        } catch (RuntimeException ex) {
            log.warn("Unable to queue patient OTP email to {}. OTP is {}", email, otp, ex);
        }
    }
}

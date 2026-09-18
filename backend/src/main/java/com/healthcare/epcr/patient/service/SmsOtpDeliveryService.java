package com.healthcare.epcr.patient.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@Slf4j
public class SmsOtpDeliveryService {
    @Value("${otp.sms.api-url:}")
    private String smsApiUrl;

    @Value("${otp.sms.api-key:}")
    private String smsApiKey;

    @Value("${otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    public void sendOtp(String phone, String otp) {
        if (smsApiUrl == null || smsApiUrl.isBlank()) {
            log.info("SMS provider API URL is not configured. Patient OTP for {} is {}", phone, otp);
            return;
        }

        try {
            RestClient client = RestClient.create(smsApiUrl);
            client.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + smsApiKey)
                    .body(Map.of(
                            "to", phone,
                            "message", "Your OTP for patient portal login is: " + otp + ". It expires in " + otpExpiryMinutes + " minutes."
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException ex) {
            log.warn("Unable to send patient OTP SMS to {}. OTP is {}", phone, otp, ex);
        }
    }
}

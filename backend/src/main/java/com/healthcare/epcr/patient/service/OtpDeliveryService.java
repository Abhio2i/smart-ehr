package com.healthcare.epcr.patient.service;

public interface OtpDeliveryService {
    void sendOtp(String identifier, String otp);
}

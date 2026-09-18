package com.healthcare.epcr.patient.service;

import com.healthcare.epcr.auth.service.JwtService;
import com.healthcare.epcr.patient.dto.PatientLoginRequest;
import com.healthcare.epcr.patient.dto.PatientOtpRequest;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PatientAuthService {
    private static final SecureRandom OTP_RANDOM = new SecureRandom();

    private final PatientRepository patientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpDeliveryService otpDeliveryService;
    private final PatientOtpCacheService patientOtpCacheService;

    @Value("${otp.expiry-minutes:10}")
    private int otpExpiryMinutes;

    public Map<String, String> requestOtp(PatientOtpRequest request) {
        Patient patient = resolvePatientByEmailOrPhone(request.getIdentifier())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found for provided email or phone"));

        if (!patient.isActive()) {
            throw new IllegalArgumentException("Patient account is inactive");
        }

        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        patientOtpCacheService.storeOtp(
                request.getIdentifier(),
                passwordEncoder.encode(otp),
                Duration.ofMinutes(otpExpiryMinutes)
        );

        otpDeliveryService.sendOtp(request.getIdentifier(), otp);

        return Map.of(
                "message", "OTP sent successfully",
                "identifier", maskIdentifier(request.getIdentifier())
        );
    }

    public Map<String, String> login(PatientLoginRequest request) {
        Patient patient = resolvePatientByEmailOrPhone(request.getIdentifier())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found for provided email or phone"));
        if (!patient.isActive()) {
            throw new IllegalArgumentException("Patient account is inactive");
        }
        String storedOtpHash = patientOtpCacheService.getOtpHash(request.getIdentifier())
                .orElseThrow(() -> new IllegalArgumentException("OTP expired or not set"));
        if (!passwordEncoder.matches(request.getOtp(), storedOtpHash)) {
            throw new IllegalArgumentException("Invalid OTP");
        }

        patientOtpCacheService.deleteOtp(request.getIdentifier());

        if (patient.getOtpHash() != null || patient.getOtpExpiresAt() != null) {
            patient.setOtpHash(null);
            patient.setOtpExpiresAt(null);
        }
        patient.setLastLoginAt(LocalDateTime.now());
        patient.setUpdatedAt(LocalDateTime.now());
        patientRepository.save(patient);
        String subject = patient.getEmail() != null && !patient.getEmail().isBlank() ? patient.getEmail() : patient.getPhone();
        String token = jwtService.generatePatientToken(patient.getPatientId(), patient.getOrganizationId(), subject == null ? patient.getPatientId() : subject);
        return Map.of("token", token, "patientId", patient.getPatientId(), "organizationId", patient.getOrganizationId());
    }

    public PatientPrincipal me(PatientPrincipal principal) {
        return principal;
    }

    private Optional<Patient> resolvePatientByEmailOrPhone(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Email or phone is required");
        }

        String normalized = identifier.trim();
        if (isEmail(normalized)) {
            return singlePatient(patientRepository.findAllByEmail(normalized), "email");
        }
        if (isPhone(normalized)) {
            return singlePatient(patientRepository.findAllByPhone(normalized), "phone number");
        }
        throw new IllegalArgumentException("Identifier must be a valid email or phone number");
    }

    private Optional<Patient> singlePatient(List<Patient> patients, String identifierType) {
        if (patients == null || patients.isEmpty()) {
            return Optional.empty();
        }
        if (patients.size() > 1) {
            throw new IllegalArgumentException("Multiple patient accounts found for this " + identifierType + ". Please contact support.");
        }
        return Optional.of(patients.get(0));
    }

    private boolean isEmail(String value) {
        return value.contains("@");
    }

    private boolean isPhone(String value) {
        return value.matches("^\\+?[0-9]{7,15}$");
    }

    private String maskIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return "";
        }
        String value = identifier.trim();
        if (isEmail(value)) {
            int at = value.indexOf('@');
            if (at <= 1) {
                return "***" + value.substring(at);
            }
            return value.substring(0, 1) + "***" + value.substring(at);
        }
        if (value.length() <= 4) {
            return "****";
        }
        return "****" + value.substring(value.length() - 4);
    }
}

package com.healthcare.epcr.patient.controller;

import com.healthcare.epcr.auth.service.JwtService;
import com.healthcare.epcr.patient.dto.PatientLoginRequest;
import com.healthcare.epcr.patient.dto.PatientOtpRequest;
import com.healthcare.epcr.patient.security.PatientPrincipal;
import com.healthcare.epcr.patient.service.PatientAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/patient/auth")
@RequiredArgsConstructor
public class PatientAuthController {
    private final PatientAuthService patientAuthService;
    private final JwtService jwtService;

    @PostMapping("/request-otp")
    public ResponseEntity<Map<String, String>> requestOtp(@Valid @RequestBody PatientOtpRequest request) {
        return ResponseEntity.ok(patientAuthService.requestOtp(request));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@Valid @RequestBody PatientLoginRequest request) {
        Map<String, String> result = patientAuthService.login(request);
        return ResponseEntity.ok()
                .header("Set-Cookie", jwtService.generatePatientJwtCookie(result.get("token")).toString())
                .body(Map.of(
                        "token", result.get("token"),
                        "patientId", result.get("patientId"),
                        "organizationId", result.get("organizationId")
                ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header("Set-Cookie", jwtService.getCleanPatientJwtCookie().toString())
                .header("Set-Cookie", jwtService.getCleanPatientJwtCookieAtPath("/").toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<PatientPrincipal> me(@AuthenticationPrincipal PatientPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("Patient authentication required");
        }
        return ResponseEntity.ok(patientAuthService.me(principal));
    }
}

package com.healthcare.epcr.patient.security;

public record PatientPrincipal(String patientId, String organizationId, String subject) {
}


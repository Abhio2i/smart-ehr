package com.healthcare.epcr.patient.service;

import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import com.healthcare.epcr.patient.dto.PatientSearchResultDTO;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.patienthistory.dto.PatientOverviewRouteDTO;
import com.healthcare.epcr.patienthistory.service.PatientOverviewRoutingService;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PatientAdminService {
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final AccessControlService accessControlService;
    private final PhiCryptoService phiCryptoService;
    private final PatientSearchCacheService patientSearchCacheService;
    private final PatientOverviewRoutingService patientOverviewRoutingService;

    public PatientSearchResultDTO getPatientById(String patientId) {
        return patientRepository.findByPatientId(patientId)
                .map(this::toSearchResult)
                .orElse(null);
    }

    public List<PatientSearchResultDTO> searchByPhone(String query, Integer limit) {
        int resolvedLimit = limit == null ? DEFAULT_LIMIT : Math.min(Math.max(limit, 1), MAX_LIMIT);
        String trimmedQuery = query == null ? "" : query.trim().toLowerCase();
        String digitsOnly = trimmedQuery.replaceAll("\\D", "");

        var cached = patientSearchCacheService.getSearch(trimmedQuery, resolvedLimit);
        if (cached.isPresent()) {
            return cached.get();
        }

        Map<String, Patient> matchesById = new LinkedHashMap<>();
        addMatches(matchesById, patientRepository.findAll().stream()
                .filter(patient -> matchesQuery(patient, trimmedQuery, digitsOnly))
                .toList());

        Map<String, PatientSearchResultDTO> resultsByPatientId = new LinkedHashMap<>();
        matchesById.values().stream()
                .filter(patient -> accessControlService.canAccessOrganization(patient.getOrganizationId()))
                .limit(resolvedLimit)
                .map(this::toSearchResult)
                .forEach(result -> resultsByPatientId.putIfAbsent(result.getPatientId(), result));

        if (resultsByPatientId.size() < resolvedLimit) {
            patientCareRecordRepository.findAll().stream()
                    .filter(record -> accessControlService.canAccessOrganization(record.getOrganizationId()))
                    .filter(record -> recordMatchesQuery(record, trimmedQuery, digitsOnly))
                    .sorted(Comparator.comparing(PatientCareRecord::getUpdatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::toSearchResult)
                    .filter(Objects::nonNull)
                    .forEach(result -> {
                        if (resultsByPatientId.size() < resolvedLimit) {
                            resultsByPatientId.putIfAbsent(result.getPatientId(), result);
                        }
                    });
        }

        List<PatientSearchResultDTO> results = resultsByPatientId.values().stream().toList();
        patientSearchCacheService.putSearch(trimmedQuery, resolvedLimit, results);
        return results;
    }

    private boolean matchesQuery(Patient patient, String queryLower, String digitsOnly) {
        if (queryLower.isEmpty()) return true;
        
        if (patient.getPatientId() != null && patient.getPatientId().toLowerCase().contains(queryLower)) return true;
        if (patient.getEmail() != null && patient.getEmail().toLowerCase().contains(queryLower)) return true;
        if (plainPhoneMatches(patient.getPhone(), queryLower, digitsOnly)) return true;

        // Decrypt and match patient name from latest record
        PatientCareRecord latestRecord = patientCareRecordRepository.findByPatientId(patient.getPatientId()).stream()
                .max(Comparator.comparing(PatientCareRecord::getUpdatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        if (latestRecord != null && latestRecord.getPatientName() != null) {
            String decryptedName = phiCryptoService.decrypt(latestRecord.getPatientName());
            if (decryptedName != null && decryptedName.toLowerCase().contains(queryLower)) return true;
        }
        return false;
    }
    
    private boolean recordMatchesQuery(PatientCareRecord record, String queryLower, String digitsOnly) {
        if (queryLower.isEmpty()) return true;
        
        if (record.getPatientId() != null && record.getPatientId().toLowerCase().contains(queryLower)) return true;
        
        String decryptedName = phiCryptoService.decrypt(record.getPatientName());
        if (decryptedName != null && decryptedName.toLowerCase().contains(queryLower)) return true;

        String decryptedEmail = phiCryptoService.decrypt(record.getEmail());
        if (decryptedEmail != null && decryptedEmail.toLowerCase().contains(queryLower)) return true;
        
        return phoneMatches(record.getPatientPhone(), queryLower, digitsOnly);
    }

    private void addMatches(Map<String, Patient> matchesById, List<Patient> patients) {
        for (Patient patient : patients) {
            String key = patient.getId() == null ? patient.getPatientId() : patient.getId();
            matchesById.putIfAbsent(key, patient);
        }
    }

    private PatientSearchResultDTO toSearchResult(Patient patient) {
        PatientCareRecord latestRecord = patientCareRecordRepository.findByPatientId(patient.getPatientId()).stream()
                .max(Comparator.comparing(PatientCareRecord::getUpdatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);

        String displayName = latestRecord == null ? null : phiCryptoService.decrypt(latestRecord.getPatientName());
        String dateOfBirth = latestRecord == null ? null : phiCryptoService.decrypt(latestRecord.getPatientDateOfBirth());
        String phone = latestRecord == null ? patient.getPhone() : firstNonBlank(
                phiCryptoService.decrypt(latestRecord.getPatientPhone()),
                patient.getPhone()
        );
        String email = latestRecord == null ? patient.getEmail() : firstNonBlank(
                phiCryptoService.decrypt(latestRecord.getEmail()),
                patient.getEmail()
        );
        if (displayName == null || displayName.isBlank()) {
            displayName = patient.getEmail() != null && !patient.getEmail().isBlank()
                    ? patient.getEmail()
                    : patient.getPatientId();
        }

        PatientSearchResultDTO result = buildSearchResult(
                patient.getId(),
                patient.getPatientId(),
                patient.getOrganizationId(),
                displayName,
                dateOfBirth,
                latestRecord == null ? null : latestRecord.getPatientGender(),
                phone,
                email,
                latestRecord == null ? null : phiCryptoService.decrypt(latestRecord.getPatientSSNLast4()),
                latestRecord == null ? null : latestRecord.getAge(),
                latestRecord == null ? null : phiCryptoService.decrypt(latestRecord.getBloodGroup()),
                latestRecord == null ? null : latestRecord.getHeight(),
                latestRecord == null ? null : latestRecord.getWeight(),
                patient.isActive());
        applyLatestRecordFields(result, latestRecord);
        return result;
    }

    private PatientSearchResultDTO toSearchResult(PatientCareRecord record) {
        if (record == null || record.getPatientId() == null || record.getPatientId().isBlank()) {
            return null;
        }
        PatientSearchResultDTO result = buildSearchResult(
                null,
                record.getPatientId(),
                record.getOrganizationId(),
                fallback(phiCryptoService.decrypt(record.getPatientName()), record.getPatientId()),
                phiCryptoService.decrypt(record.getPatientDateOfBirth()),
                record.getPatientGender(),
                phiCryptoService.decrypt(record.getPatientPhone()),
                phiCryptoService.decrypt(record.getEmail()),
                phiCryptoService.decrypt(record.getPatientSSNLast4()),
                record.getAge(),
                phiCryptoService.decrypt(record.getBloodGroup()),
                record.getHeight(),
                record.getWeight(),
                true);
        applyLatestRecordFields(result, record);
        return result;
    }

    private PatientSearchResultDTO buildSearchResult(String id, String patientId, String organizationId,
                                                     String patientName, String patientDateOfBirth,
                                                     com.healthcare.epcr.epcr.enums.PatientGender patientGender,
                                                     String patientPhone, String email, String patientSSNLast4,
                                                     Integer age, String bloodGroup, Double height, Double weight,
                                                     boolean active) {
        PatientSearchResultDTO result = new PatientSearchResultDTO();
        result.setId(id);
        result.setPatientId(patientId);
        result.setOrganizationId(organizationId);
        result.setDisplayName(patientName);
        result.setDateOfBirth(patientDateOfBirth);
        result.setGender(patientGender);
        result.setPhone(patientPhone);
        result.setEmail(email);
        result.setSsnLast4(patientSSNLast4);
        result.setPatientName(patientName);
        result.setPatientDateOfBirth(patientDateOfBirth);
        result.setPatientGender(patientGender);
        result.setPatientPhone(patientPhone);
        result.setPatientSSNLast4(patientSSNLast4);
        result.setAge(age);
        result.setBloodGroup(bloodGroup);
        result.setHeight(height);
        result.setWeight(weight);
        result.setActive(active);
        return result;
    }

    private void applyLatestRecordFields(PatientSearchResultDTO result, PatientCareRecord record) {
        if (result == null || record == null) {
            return;
        }
        result.setPatientAddress(phiCryptoService.decrypt(record.getPatientAddress()));
        result.setMedicalHistory(record.getMedicalHistory());
        result.setSpo2(record.getSpo2());
        result.setRespirationRate(record.getRespirationRate());
        result.setBloodSugar(record.getBloodSugar());
        result.setHeartRate(record.getHeartRate());
        result.setDiastolicBp(record.getDiastolicBp());
        result.setSystolicBp(record.getSystolicBp());
        result.setPulseRate(record.getPulseRate());
        result.setTemperature(record.getTemperature());
        result.setHemoglobin(record.getHemoglobin());
        result.setComorbidity(phiCryptoService.decrypt(record.getComorbidity()));
        result.setAllergy(phiCryptoService.decrypt(record.getAllergy()));
        result.setDoctor(phiCryptoService.decrypt(record.getDoctor()));
        result.setCurrentMedicines(phiCryptoService.decrypt(record.getCurrentMedicines()));
        PatientOverviewRouteDTO route = patientOverviewRoutingService.route(
                record.getPatientId(),
                record.getId(),
                record.getIncidentType()
        );
        result.setLatestRecordId(record.getId());
        result.setLatestIncidentType(record.getIncidentType());
        result.setOverviewType(route.getOverviewType());
        result.setFrontendRouteKey(route.getFrontendRouteKey());
    }

    private boolean phoneMatches(String storedPhone, String searchValue, String searchDigits) {
        String decrypted = phiCryptoService.decrypt(storedPhone);
        return plainPhoneMatches(decrypted, searchValue, searchDigits);
    }

    private boolean plainPhoneMatches(String storedPhone, String searchValue, String searchDigits) {
        if (storedPhone == null || storedPhone.isBlank()) {
            return false;
        }
        String normalizedStored = storedPhone.trim();
        String storedDigits = normalizedStored.replaceAll("\\D", "");
        return normalizedStored.contains(searchValue)
                || (!searchDigits.isBlank() && storedDigits.contains(searchDigits));
    }

    private String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}

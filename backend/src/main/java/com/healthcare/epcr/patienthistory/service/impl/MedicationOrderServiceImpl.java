package com.healthcare.epcr.patienthistory.service.impl;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.repository.PatientCareRecordRepository;
import com.healthcare.epcr.epcr.service.MedicationSafetyService;
import com.healthcare.epcr.patienthistory.dto.CreateMedicationOrderRequest;
import com.healthcare.epcr.patienthistory.dto.MedicationOrderDTO;
import com.healthcare.epcr.patienthistory.model.MedicationOrder;
import com.healthcare.epcr.patienthistory.repository.MedicationOrderRepository;
import com.healthcare.epcr.patienthistory.service.IMedicationOrderService;
import com.healthcare.epcr.patienthistory.service.PatientHistoryCacheService;
import com.healthcare.epcr.patient.model.Patient;
import com.healthcare.epcr.patient.repository.PatientRepository;
import com.healthcare.epcr.phi.crypto.PhiCryptoService;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MedicationOrderServiceImpl implements IMedicationOrderService {

    private final MedicationOrderRepository orderRepository;
    private final PatientRepository patientRepository;
    private final PatientCareRecordRepository patientCareRecordRepository;
    private final MedicationSafetyService safetyService;
    private final PhiCryptoService phiCryptoService;
    private final AccessControlService accessControlService;
    private final PatientHistoryCacheService patientHistoryCacheService;

    @Override
    public List<MedicationOrderDTO> getPatientOrders(String patientId) {
        Patient patient = assertPatientAccess(patientId);
        return orderRepository.findByPatientId(patientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public MedicationOrderDTO createOrder(String patientId, CreateMedicationOrderRequest request) {
        Patient patient = assertPatientAccess(patientId);
        var currentUser = accessControlService.currentUser();
        LocalDateTime now = LocalDateTime.now();

        MedicationOrder order = new MedicationOrder();
        order.setPatientId(patientId);
        order.setOrganizationId(patient.getOrganizationId());
        order.setPrescribingDoctorId(currentUser.getId());
        
        String docName = ((currentUser.getFirstName() != null ? currentUser.getFirstName() : "") + " " + (currentUser.getLastName() != null ? currentUser.getLastName() : "")).trim();
        if (docName.isEmpty()) {
            docName = currentUser.getEmail();
        }
        order.setPrescribingDoctorName(docName);

        order.setDrugId(request.getDrugId());
        order.setDrugGenericName(request.getDrugGenericName());
        order.setDrugBrandName(request.getDrugBrandName());
        order.setDosageStrength(request.getDosageStrength());
        order.setRoute(request.getRoute());
        order.setFrequency(request.getFrequency());
        
        order.setStartDate(request.getStartDate() != null ? request.getStartDate() : LocalDate.now());
        order.setEndDate(request.getEndDate());
        order.setRefillsAuthorized(request.getRefillsAuthorized() != null ? request.getRefillsAuthorized() : 0);
        order.setInstructions(request.getInstructions());

        order.setClinicalIndication(request.getClinicalIndication());
        order.setPharmacyRouting(request.getPharmacyRouting());

        // Validate e-Signature PIN format
        String pin = request.getEsignaturePin();
        if (pin == null || !pin.matches("^\\d{4}$")) {
            throw new IllegalArgumentException("Invalid Electronic Signature PIN. Must be a 4-digit numeric code.");
        }
        order.setEsignaturePin(pin);

        order.setOrderStatus("ACTIVE");
        order.setSignedAt(now);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        MedicationOrder saved = orderRepository.save(order);
        log.info("Medication order signed successfully for patient: {}, drug: {}", patientId, request.getDrugGenericName());
        try {
            patientHistoryCacheService.evictPatientHistory(patientId);
        } catch (Exception e) {
            log.warn("Failed to evict patient history cache for patient: {}", patientId, e);
        }
        return toDTO(saved);
    }

    @Override
    public MedicationOrderDTO discontinueOrder(String patientId, String orderId, String reason) {
        assertPatientAccess(patientId);

        MedicationOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Medication order not found with ID: " + orderId));
        
        if (!order.getPatientId().equals(patientId)) {
            throw new IllegalArgumentException("Order does not belong to the specified patient");
        }

        order.setOrderStatus("DISCONTINUED");
        order.setDiscontinueReason(reason);
        order.setUpdatedAt(LocalDateTime.now());

        MedicationOrder saved = orderRepository.save(order);
        log.info("Medication order discontinued for patient: {}, orderId: {}, reason: {}", patientId, orderId, reason);
        try {
            patientHistoryCacheService.evictPatientHistory(patientId);
        } catch (Exception e) {
            log.warn("Failed to evict patient history cache for patient: {}", patientId, e);
        }
        return toDTO(saved);
    }

    @Override
    public List<MedicationSafetyAlert> checkOrderSafety(String patientId, String genericName) {
        assertPatientAccess(patientId);

        String allergyText = "No known allergies";
        List<String> activeMeds = new ArrayList<>();

        // 1. Gather allergy list and current medications from latest ePCR record
        Optional<PatientCareRecord> latestRecord = patientCareRecordRepository.findByPatientId(patientId).stream()
                .max(Comparator.comparing(PatientCareRecord::getUpdatedAt, Comparator.nullsFirst(Comparator.naturalOrder())));
        
        if (latestRecord.isPresent()) {
            PatientCareRecord rec = latestRecord.get();
            if (rec.getAllergy() != null) {
                allergyText = phiCryptoService.decrypt(rec.getAllergy());
            }
            if (rec.getCurrentMedicines() != null) {
                String activeRaw = phiCryptoService.decrypt(rec.getCurrentMedicines());
                if (activeRaw != null) {
                    for (String med : activeRaw.toLowerCase().split("[,;\\s]|\\band\\b")) {
                        String trimmed = med.trim();
                        if (!trimmed.isEmpty() && trimmed.length() >= 3) {
                            activeMeds.add(trimmed);
                        }
                    }
                }
            }
        }

        // 2. Gather active medication orders in the prescription registry
        List<MedicationOrder> activeOrders = orderRepository.findByPatientIdAndOrderStatus(patientId, "ACTIVE");
        for (MedicationOrder order : activeOrders) {
            if (order.getDrugGenericName() != null && !order.getDrugGenericName().isBlank()) {
                String cleanGeneric = order.getDrugGenericName().trim().toLowerCase();
                if (!activeMeds.contains(cleanGeneric)) {
                    activeMeds.add(cleanGeneric);
                }
            }
        }

        // 3. Call safety checker helper in safety service
        return safetyService.checkSafetyManual(allergyText, activeMeds, genericName);
    }

    private Patient assertPatientAccess(String patientId) {
        Patient patient = patientRepository.findByPatientId(patientId)
                .or(() -> patientRepository.findById(patientId))
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with ID: " + patientId));
        accessControlService.assertOrganizationAccess(patient.getOrganizationId());
        return patient;
    }

    private MedicationOrderDTO toDTO(MedicationOrder order) {
        if (order == null) {
            return null;
        }
        MedicationOrderDTO dto = new MedicationOrderDTO();
        dto.setId(order.getId());
        dto.setPatientId(order.getPatientId());
        dto.setOrganizationId(order.getOrganizationId());
        dto.setPrescribingDoctorId(order.getPrescribingDoctorId());
        dto.setPrescribingDoctorName(order.getPrescribingDoctorName());
        dto.setDrugId(order.getDrugId());
        dto.setDrugGenericName(order.getDrugGenericName());
        dto.setDrugBrandName(order.getDrugBrandName());
        dto.setDosageStrength(order.getDosageStrength());
        dto.setRoute(order.getRoute());
        dto.setFrequency(order.getFrequency());
        dto.setStartDate(order.getStartDate());
        dto.setEndDate(order.getEndDate());
        dto.setRefillsAuthorized(order.getRefillsAuthorized());
        dto.setInstructions(order.getInstructions());
        dto.setOrderStatus(order.getOrderStatus());
        dto.setDiscontinueReason(order.getDiscontinueReason());
        dto.setSignedAt(order.getSignedAt());

        dto.setClinicalIndication(order.getClinicalIndication());
        dto.setPharmacyRouting(order.getPharmacyRouting());
        dto.setEsignaturePin(order.getEsignaturePin());

        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());
        return dto;
    }
}

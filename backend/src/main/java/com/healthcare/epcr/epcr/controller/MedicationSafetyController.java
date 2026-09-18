package com.healthcare.epcr.epcr.controller;

import com.healthcare.epcr.epcr.dto.MedicationSafetyAlert;
import com.healthcare.epcr.epcr.model.MedicationAdministered;
import com.healthcare.epcr.epcr.model.PatientCareRecord;
import com.healthcare.epcr.epcr.service.MedicationSafetyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/medications")
@RequiredArgsConstructor
@Tag(name = "Medication Safety", description = "Verifies medication safety checks against allergy and drug interaction records")
public class MedicationSafetyController {

    private final MedicationSafetyService safetyService;

    @PostMapping("/check-safety")
    @PreAuthorize("hasAnyRole('ADMIN','PARAMEDIC','PHYSICIAN','QA_REVIEWER')")
    @Operation(
        summary = "Check Medication Safety & Interactions",
        description = "Evaluates a proposed medication against active allergies and current medications of a patient."
    )
    public ResponseEntity<List<MedicationSafetyAlert>> checkMedicationSafety(
            @RequestBody PatientCareRecord record,
            @RequestParam String medName) {

        MedicationAdministered newMed = new MedicationAdministered();
        newMed.setMedicationName(medName);

        List<MedicationSafetyAlert> alerts = safetyService.checkSafety(record, newMed);
        return ResponseEntity.ok(alerts);
    }
}

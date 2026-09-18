package com.healthcare.epcr.epcr.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import com.healthcare.epcr.epcr.enums.RecordStatus;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.epcr.dto.CreatePatientCareRecordRequest;
import com.healthcare.epcr.epcr.service.IPatientCareRecordService;
import com.healthcare.epcr.common.dto.PageResponse;
import com.healthcare.epcr.security.AccessControlService;
import com.healthcare.epcr.user.model.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import com.healthcare.epcr.config.SupabaseStorageService;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/epcr/records")
@RequiredArgsConstructor
public class PatientCareRecordController {
    private final IPatientCareRecordService recordService;
    private final AccessControlService accessControlService;
    private final SupabaseStorageService supabaseStorageService;

    @PostMapping(value = "/upload-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PARAMEDIC', 'QA_REVIEWER', 'PHYSICIAN', 'ADMIN')")
    @Operation(summary = "Upload patient photo to Supabase Storage", description = "Uploads patient photo image file to Supabase S3 storage bucket and returns the photo URL.")
    public ResponseEntity<Map<String, String>> uploadPatientPhoto(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        String objectKey = supabaseStorageService.uploadFile("photos", file);
        String signedUrl = supabaseStorageService.generateSignedUrl(objectKey);
        return ResponseEntity.ok(Map.of(
                "objectKey", objectKey,
                "patientPhotoUrl", signedUrl
        ));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PARAMEDIC', 'QA_REVIEWER', 'PHYSICIAN', 'ADMIN')")
    @Operation(summary = "Create ePCR record", description = "Creates a new ePCR incident. Omit patientId for a new patient profile, or send an existing patientId to reuse the patient and create only a new incident. incidentNumber is generated automatically by the backend.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Record created",
                    content = @Content(schema = @Schema(implementation = PatientCareRecordDTO.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "401", description = "Unauthorized"),
            @ApiResponse(responseCode = "403", description = "Forbidden")
    })
    public ResponseEntity<PatientCareRecordDTO> createRecord(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = CreatePatientCareRecordRequest.class),
                            examples = @ExampleObject(
                                    name = "Create ePCR request",
                                    value = "{\n" +
                                            "  \"patientName\": \"Test Patient\",\n" +
                                            "  \"patientDateOfBirth\": \"1990-01-15\",\n" +
                                            "  \"patientGender\": \"MALE\",\n" +
                                            "  \"patientPhone\": \"+1234567890\",\n" +
                                            "  \"patientAddress\": \"123 Test Street\",\n" +
                                            "  \"patientSSNLast4\": \"1234\",\n" +
                                            "  \"medicalHistory\": {\n" +
                                            "    \"pastConditions\": [\"Hypertension\"],\n" +
                                            "    \"currentMedications\": [\"Lisinopril\"],\n" +
                                            "    \"allergies\": [\"Penicillin\"],\n" +
                                            "    \"dnrOnFile\": false\n" +
                                            "  },\n" +
                                            "  \"incidentDateTime\": \"2026-05-01T10:30:00\",\n" +
                                            "  \"incidentLocation\": \"Main Road\",\n" +
                                            "  \"incidentDescription\": \"Road traffic incident\",\n" +
                                            "  \"incidentType\": \"critical-care-transfer\",\n" +
                                            "  \"sceneAssessment\": {\n" +
                                            "    \"sceneType\": \"Roadway\",\n" +
                                            "    \"sceneSafe\": true,\n" +
                                            "    \"traumaCall\": true,\n" +
                                            "    \"numberOfPatients\": 1\n" +
                                            "  },\n" +
                                            "  \"crew\": [{\"paramedicsId\": \"user123\", \"name\": \"Alex Carter\", \"role\": \"Lead Paramedic\", \"primaryClinician\": true}],\n" +
                                            "  \"timeline\": {\"callReceivedAt\": \"2026-05-01T10:15:00\", \"arrivedSceneAt\": \"2026-05-01T10:28:00\"},\n" +
                                            "  \"complaints\": [\"Chest pain\"],\n" +
                                            "  \"vitals\": [\"BP 120/80\", \"Pulse 88\"],\n" +
                                            "  \"structuredComplaints\": [{\"complaint\": \"Chest pain\", \"onset\": \"Sudden\", \"severity\": 7, \"traumaRelated\": false}],\n" +
                                            "  \"structuredVitals\": [{\"recordedAt\": \"2026-05-01T10:32:00\", \"heartRate\": 88, \"systolicBP\": 120, \"diastolicBP\": 80, \"oxygenSaturation\": 96, \"recordedBy\": \"user123\"}],\n" +
                                            "  \"diagnosis\": \"Mild trauma\",\n" +
                                            "  \"treatmentProvided\": \"First aid\",\n" +
                                            "  \"treatmentPlan\": \"Monitor vitals, provide oxygen as needed, and transport for ED evaluation\",\n" +
                                            "  \"transportDestination\": \"City General Hospital\",\n" +
                                            "  \"transportMode\": \"AIR\",\n" +
                                            "  \"careLevel\": \"CRITICAL\",\n" +
                                            "  \"icd10Code\": \"R07.9\",\n" +
                                            "  \"primaryImpression\": \"Acute chest pain\",\n" +
                                            "  \"secondaryImpression\": \"Anxiety\",\n" +
                                            "  \"medicationsAdministered\": [\"Midazolam\"],\n" +
                                            "  \"proceduresPerformed\": [\"Mechanical ventilation\"],\n" +
                                            "  \"structuredMedications\": [{\"medicationName\": \"Midazolam\", \"dosage\": 2.0, \"unit\": \"mg\", \"route\": \"IV\", \"administeredAt\": \"2026-05-01T10:35:00\"}],\n" +
                                            "  \"structuredProcedures\": [{\"procedureName\": \"Mechanical ventilation\", \"performedAt\": \"2026-05-01T10:36:00\", \"successful\": true}],\n" +
                                            "  \"transport\": {\"transportMode\": \"AIR\", \"destinationName\": \"City General Hospital\", \"careLevel\": \"CRITICAL\", \"hospitalNotified\": true},\n" +
                                            "  \"consent\": {\"patientConsentObtained\": true, \"consentType\": \"VERBAL\", \"patientHasDecisionCapacity\": true},\n" +
                                            "  \"clinicalData\": {\"fio2\": \"60%\"},\n" +
                                            "  \"dynamicFormResponses\": {\"safetyChecklistComplete\": true}\n" +
                                            "}"
                            )
                    )
            )
            @Valid @RequestBody CreatePatientCareRecordRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(recordService.createRecord(request, idempotencyKey));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get ePCR record by ID")
    public ResponseEntity<PatientCareRecordDTO> getRecordById(@Parameter(description = "Record ID") @PathVariable String id) {
        Optional<PatientCareRecordDTO> record = recordService.getRecordById(id);
        return record.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    @Operation(summary = "Get all ePCR records", description = "Returns paginated records with optional filters: status, incidentType, search, startDate, endDate.")
    public ResponseEntity<?> getAllRecords(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String paramedicId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String incidentType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        boolean allowParamedicFilter = false;
        try {
            var user = accessControlService.currentUser();
            allowParamedicFilter = user != null
                    && (user.getRole() == Role.ADMIN || accessControlService.isSystemWideQaUser(user));
        } catch (Exception ignored) {}
        String effectiveParamedicId = allowParamedicFilter ? paramedicId : null;

        // Parse optional filters
        RecordStatus statusEnum = null;
        if (status != null && !status.isBlank()) {
            try { statusEnum = RecordStatus.valueOf(status.toUpperCase()); } catch (IllegalArgumentException ignored) {}
        }
        java.time.LocalDateTime start = null;
        java.time.LocalDateTime end   = null;
        if (startDate != null && !startDate.isBlank()) {
            try { start = java.time.LocalDate.parse(startDate).atStartOfDay(); } catch (Exception ignored) {}
        }
        if (endDate != null && !endDate.isBlank()) {
            try { end = java.time.LocalDate.parse(endDate).atTime(23, 59, 59); } catch (Exception ignored) {}
        }

        int resolvedPage = page == null ? 0 : Math.max(page, 0);
        int resolvedSize = size == null ? 20 : Math.min(Math.max(size, 1), 200);
        PageResponse<PatientCareRecordDTO> paged = recordService.getAllRecordsPaginated(
                resolvedPage, resolvedSize, effectiveParamedicId,
                statusEnum, incidentType, search, start, end);
        return ResponseEntity.ok(paged);
    }

    @GetMapping("/paramedic/{paramedicsId}")
    @Operation(summary = "Get ePCR records by paramedic")
    public ResponseEntity<List<PatientCareRecordDTO>> getRecordsByParamedic(@PathVariable String paramedicsId) {
        return ResponseEntity.ok(recordService.getRecordsByParamedic(paramedicsId));
    }

    @GetMapping("/organization/{organizationId}")
    @Operation(summary = "Get ePCR records by organization")
    public ResponseEntity<List<PatientCareRecordDTO>> getRecordsByOrganization(@PathVariable String organizationId) {
        return ResponseEntity.ok(recordService.getRecordsByOrganization(organizationId));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Get ePCR records by workflow status")
    public ResponseEntity<List<PatientCareRecordDTO>> getRecordsByStatus(@PathVariable RecordStatus status) {
        return ResponseEntity.ok(recordService.getRecordsByStatus(status));
    }

    @GetMapping("/qa/pending")
    @Operation(summary = "Get records pending QA approval")
    public ResponseEntity<List<PatientCareRecordDTO>> getPendingQAApproval() {
        return ResponseEntity.ok(recordService.getPendingQAApproval());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PARAMEDIC', 'QA_REVIEWER', 'PHYSICIAN', 'ADMIN')")
    @Operation(summary = "Update ePCR record", description = "Partially updates an existing ePCR record. Any omitted fields remain unchanged.")
    public ResponseEntity<PatientCareRecordDTO> updateRecord(@PathVariable String id,
                                                          @Valid @RequestBody CreatePatientCareRecordRequest request) {
        return ResponseEntity.ok(recordService.updateRecord(id, request));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAnyRole('PARAMEDIC', 'QA_REVIEWER', 'PHYSICIAN', 'ADMIN')")
    @Operation(summary = "Submit ePCR record", description = "Submits a draft record and appends submit audit entry.")
    public ResponseEntity<PatientCareRecordDTO> submitRecord(@PathVariable String id) {
        return ResponseEntity.ok(recordService.submitRecord(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PARAMEDIC', 'ADMIN')")
    @Operation(summary = "Delete ePCR record")
    public ResponseEntity<Void> deleteRecord(@PathVariable String id) {
        recordService.deleteRecord(id);
        return ResponseEntity.noContent().build();
    }
}



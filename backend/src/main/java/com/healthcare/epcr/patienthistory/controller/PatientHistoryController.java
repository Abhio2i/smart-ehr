package com.healthcare.epcr.patienthistory.controller;

import com.healthcare.epcr.patienthistory.dto.PatientHistorySummaryDTO;
import com.healthcare.epcr.patienthistory.dto.PatientTimelineEventDTO;
import com.healthcare.epcr.patienthistory.model.PatientAdmission;
import com.healthcare.epcr.patienthistory.model.PatientCondition;
import com.healthcare.epcr.patienthistory.model.PatientDocument;
import com.healthcare.epcr.patienthistory.model.PatientEncounter;
import com.healthcare.epcr.patienthistory.model.PatientLabResult;
import com.healthcare.epcr.patienthistory.model.PatientMedication;
import com.healthcare.epcr.patienthistory.model.PatientVital;
import com.healthcare.epcr.patienthistory.model.PatientClinicalOrder;
import com.healthcare.epcr.patienthistory.service.PatientHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/patients/{patientId}/history")
@RequiredArgsConstructor
@Tag(name = "Patient History", description = "Longitudinal patient history. Admin and paramedic users can create, update, delete, and view. Authenticated patients can only view their own history.")
@SecurityRequirement(name = "bearerAuth")
public class PatientHistoryController {
    private static final String READ_HISTORY_AUTH = "hasAnyRole('ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'VIEWER', 'QA_REVIEWER') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";
    private static final String MANAGE_HISTORY_AUTH = "hasAnyRole('ADMIN', 'PARAMEDIC', 'PHYSICIAN') "
            + "or authentication.principal instanceof T(com.healthcare.epcr.patient.security.PatientPrincipal)";
    private static final String READ_ACCESS = "Access: ADMIN and PARAMEDIC can view any patient in their organization. Patient JWT users can view only their own history.";
    private static final String MANAGE_ACCESS = "Access: ADMIN, PARAMEDIC, and PHYSICIAN can manage patients in their organization. Patient JWT users can manage only their own history.";

    private final PatientHistoryService patientHistoryService;

    @GetMapping
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get complete patient history", description = "Returns all history entities and a newest-first timeline. " + READ_ACCESS)
    public ResponseEntity<PatientHistorySummaryDTO> getSummary(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getSummary(patientId));
    }

    @GetMapping("/records/{recordId}")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get patient history scoped to one ePCR record", description = "Returns only history entities linked to the selected incident/ePCR record. " + READ_ACCESS)
    public ResponseEntity<PatientHistorySummaryDTO> getRecordSummary(@PathVariable String patientId,
                                                                     @PathVariable String recordId) {
        return ResponseEntity.ok(patientHistoryService.getRecordSummary(patientId, recordId));
    }

    @GetMapping("/timeline")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get patient timeline", description = "Aggregates diagnoses, medications, ePCRs, admissions, labs, and documents. " + READ_ACCESS)
    public ResponseEntity<List<PatientTimelineEventDTO>> getTimeline(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getTimeline(patientId));
    }

    @GetMapping("/conditions")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient diagnoses/conditions", description = READ_ACCESS)
    public ResponseEntity<List<PatientCondition>> getConditions(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getConditions(patientId));
    }

    @PostMapping("/conditions")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient diagnosis/condition", description = MANAGE_ACCESS)
    public ResponseEntity<PatientCondition> createCondition(@PathVariable String patientId,
                                                            @Valid @RequestBody PatientCondition request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createCondition(patientId, request));
    }

    @PutMapping("/conditions/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient diagnosis/condition", description = MANAGE_ACCESS)
    public ResponseEntity<PatientCondition> updateCondition(@PathVariable String patientId, @PathVariable String id,
                                                            @Valid @RequestBody PatientCondition request) {
        return ResponseEntity.ok(patientHistoryService.updateCondition(patientId, id, request));
    }

    @DeleteMapping("/conditions/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient diagnosis/condition", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteCondition(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteCondition(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/medications")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient medications", description = READ_ACCESS)
    public ResponseEntity<List<PatientMedication>> getMedications(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getMedications(patientId));
    }

    @PostMapping("/medications")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient medication", description = MANAGE_ACCESS)
    public ResponseEntity<PatientMedication> createMedication(@PathVariable String patientId,
                                                              @Valid @RequestBody PatientMedication request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createMedication(patientId, request));
    }

    @PutMapping("/medications/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient medication", description = MANAGE_ACCESS)
    public ResponseEntity<PatientMedication> updateMedication(@PathVariable String patientId, @PathVariable String id,
                                                              @Valid @RequestBody PatientMedication request) {
        return ResponseEntity.ok(patientHistoryService.updateMedication(patientId, id, request));
    }

    @DeleteMapping("/medications/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient medication", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteMedication(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteMedication(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/encounters")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient ePCR history links", description = READ_ACCESS)
    public ResponseEntity<List<PatientEncounter>> getEncounters(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getEncounters(patientId));
    }

    @PostMapping("/encounters")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient ePCR history link", description = MANAGE_ACCESS)
    public ResponseEntity<PatientEncounter> createEncounter(@PathVariable String patientId,
                                                            @Valid @RequestBody PatientEncounter request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createEncounter(patientId, request));
    }

    @PutMapping("/encounters/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient ePCR history link", description = MANAGE_ACCESS)
    public ResponseEntity<PatientEncounter> updateEncounter(@PathVariable String patientId, @PathVariable String id,
                                                            @Valid @RequestBody PatientEncounter request) {
        return ResponseEntity.ok(patientHistoryService.updateEncounter(patientId, id, request));
    }

    @DeleteMapping("/encounters/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient ePCR history link", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteEncounter(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteEncounter(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admissions")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient hospital admissions", description = READ_ACCESS)
    public ResponseEntity<List<PatientAdmission>> getAdmissions(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getAdmissions(patientId));
    }

    @PostMapping("/admissions")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient hospital admission", description = MANAGE_ACCESS)
    public ResponseEntity<PatientAdmission> createAdmission(@PathVariable String patientId,
                                                            @Valid @RequestBody PatientAdmission request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createAdmission(patientId, request));
    }

    @PutMapping("/admissions/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient hospital admission", description = MANAGE_ACCESS)
    public ResponseEntity<PatientAdmission> updateAdmission(@PathVariable String patientId, @PathVariable String id,
                                                            @Valid @RequestBody PatientAdmission request) {
        return ResponseEntity.ok(patientHistoryService.updateAdmission(patientId, id, request));
    }

    @DeleteMapping("/admissions/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient hospital admission", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteAdmission(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteAdmission(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/labs", "/lab-results"})
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient lab results", description = READ_ACCESS)
    public ResponseEntity<List<PatientLabResult>> getLabResults(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getLabResults(patientId));
    }

    @PostMapping({"/labs", "/lab-results"})
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient lab result", description = MANAGE_ACCESS)
    public ResponseEntity<PatientLabResult> createLabResult(@PathVariable String patientId,
                                                            @Valid @RequestBody PatientLabResult request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createLabResult(patientId, request));
    }

    @PutMapping({"/labs/{id}", "/lab-results/{id}"})
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient lab result", description = MANAGE_ACCESS)
    public ResponseEntity<PatientLabResult> updateLabResult(@PathVariable String patientId, @PathVariable String id,
                                                            @Valid @RequestBody PatientLabResult request) {
        return ResponseEntity.ok(patientHistoryService.updateLabResult(patientId, id, request));
    }

    @DeleteMapping({"/labs/{id}", "/lab-results/{id}"})
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient lab result", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteLabResult(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteLabResult(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/vitals")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient vital readings", description = READ_ACCESS)
    public ResponseEntity<List<PatientVital>> getVitals(
            @PathVariable String patientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(patientHistoryService.getVitals(patientId, start, end));
    }

    @GetMapping("/vitals/latest")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get latest patient vital reading", description = READ_ACCESS)
    public ResponseEntity<PatientVital> getLatestVital(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getLatestVital(patientId));
    }

    @PostMapping("/vitals")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient vital reading", description = MANAGE_ACCESS)
    public ResponseEntity<PatientVital> createVital(@PathVariable String patientId,
                                                    @Valid @RequestBody PatientVital request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createVital(patientId, request));
    }

    @PutMapping("/vitals/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient vital reading", description = MANAGE_ACCESS)
    public ResponseEntity<PatientVital> updateVital(@PathVariable String patientId, @PathVariable String id,
                                                    @Valid @RequestBody PatientVital request) {
        return ResponseEntity.ok(patientHistoryService.updateVital(patientId, id, request));
    }

    @DeleteMapping("/vitals/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient vital reading", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteVital(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteVital(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/documents")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient history documents", description = READ_ACCESS)
    public ResponseEntity<List<PatientDocument>> getDocuments(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getDocuments(patientId));
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Upload patient history document", description = "Stores the uploaded document in the local files directory and creates patient history document metadata. " + MANAGE_ACCESS)
    public ResponseEntity<PatientDocument> uploadDocument(@PathVariable String patientId,
                                                          @RequestParam(value = "file", required = false) MultipartFile file,
                                                          @RequestParam(required = false) String type,
                                                          @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                          @RequestParam(required = false) String conditionId,
                                                          @RequestParam(required = false) String encounterId,
                                                          @RequestParam(required = false) String admissionId,
                                                          @RequestParam(required = false) String documentPhase,
                                                          @RequestParam(required = false) String notes) {
        PatientDocument document = patientHistoryService.uploadDocument(patientId, file, type, date, conditionId,
                encounterId, admissionId, documentPhase, notes);
        return ResponseEntity.status(HttpStatus.CREATED).body(document);
    }

    @PutMapping(value = "/documents/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient history document with file upload", description = "Stores a replacement uploaded document in Supabase and updates the existing document metadata. " + MANAGE_ACCESS)
    public ResponseEntity<PatientDocument> updateDocumentUpload(@PathVariable String patientId,
                                                                @PathVariable String id,
                                                                @RequestParam(required = false) MultipartFile file,
                                                                @RequestParam(required = false) String type,
                                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                                @RequestParam(required = false) String fileName,
                                                                @RequestParam(required = false) String conditionId,
                                                                @RequestParam(required = false) String encounterId,
                                                                @RequestParam(required = false) String admissionId,
                                                                @RequestParam(required = false) String documentPhase,
                                                                @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(patientHistoryService.updateDocument(patientId, id, file, type, date, fileName,
                conditionId, encounterId, admissionId, documentPhase, notes));
    }

    @PutMapping(value = "/documents/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient history document metadata", description = "Updates the existing document metadata (notes, type, etc.) without re-uploading a file. " + MANAGE_ACCESS)
    public ResponseEntity<PatientDocument> updateDocumentMetadata(@PathVariable String patientId,
                                                                  @PathVariable String id,
                                                                  @Valid @RequestBody PatientDocument request) {
        return ResponseEntity.ok(patientHistoryService.updateDocument(patientId, id, request));
    }

    @GetMapping("/documents/{id}/file")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Redirect to patient history document",
            description = "Issues an HTTP 302 redirect to a time-limited Supabase Storage pre-signed URL for secure document access. " + READ_ACCESS)
    public ResponseEntity<Void> viewDocumentFile(@PathVariable String patientId, @PathVariable String id) {
        String signedUrl = patientHistoryService.getDocumentSignedUrl(patientId, id);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, signedUrl)
                .build();
    }

    @DeleteMapping("/documents/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient history document metadata", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteDocument(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteDocument(patientId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/documents/{id}/signed-url")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "Get pre-signed URL for patient history document",
            description = "Returns a time-limited Supabase Storage pre-signed URL as JSON for direct browser access. " + READ_ACCESS)
    public ResponseEntity<java.util.Map<String, String>> getDocumentSignedUrl(
            @PathVariable String patientId, @PathVariable String id) {
        String signedUrl = patientHistoryService.getDocumentSignedUrl(patientId, id);
        return ResponseEntity.ok(java.util.Map.of("url", signedUrl));
    }

    @GetMapping("/clinical-orders")
    @PreAuthorize(READ_HISTORY_AUTH)
    @Operation(summary = "List patient clinical orders", description = READ_ACCESS)
    public ResponseEntity<List<PatientClinicalOrder>> getClinicalOrders(@PathVariable String patientId) {
        return ResponseEntity.ok(patientHistoryService.getClinicalOrders(patientId));
    }

    @PostMapping("/clinical-orders")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Create patient clinical order", description = MANAGE_ACCESS)
    public ResponseEntity<PatientClinicalOrder> createClinicalOrder(@PathVariable String patientId,
                                                                    @Valid @RequestBody PatientClinicalOrder request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientHistoryService.createClinicalOrder(patientId, request));
    }

    @PutMapping("/clinical-orders/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Update patient clinical order", description = MANAGE_ACCESS)
    public ResponseEntity<PatientClinicalOrder> updateClinicalOrder(@PathVariable String patientId, @PathVariable String id,
                                                                    @Valid @RequestBody PatientClinicalOrder request) {
        return ResponseEntity.ok(patientHistoryService.updateClinicalOrder(patientId, id, request));
    }

    @DeleteMapping("/clinical-orders/{id}")
    @PreAuthorize(MANAGE_HISTORY_AUTH)
    @Operation(summary = "Delete patient clinical order", description = MANAGE_ACCESS)
    public ResponseEntity<Void> deleteClinicalOrder(@PathVariable String patientId, @PathVariable String id) {
        patientHistoryService.deleteClinicalOrder(patientId, id);
        return ResponseEntity.noContent().build();
    }
}

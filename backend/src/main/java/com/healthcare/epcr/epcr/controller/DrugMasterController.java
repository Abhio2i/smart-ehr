package com.healthcare.epcr.epcr.controller;

import com.healthcare.epcr.epcr.model.DrugMaster;
import com.healthcare.epcr.epcr.repository.DrugMasterRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drug-master")
@RequiredArgsConstructor
@Tag(name = "Drug Master Management", description = "Endpoints for managing the master directory of medicines")
public class DrugMasterController {

    private final DrugMasterRepository drugMasterRepository;

    private void normalizeDrug(DrugMaster drug) {
        if (drug.getGenericName() != null) {
            drug.setGenericName(drug.getGenericName().trim().toLowerCase());
        }
        if (drug.getDrugClass() != null) {
            drug.setDrugClass(drug.getDrugClass().trim().toUpperCase());
        }
        if (drug.getBrandNames() != null) {
            drug.getBrandNames().replaceAll(b -> b.trim().toLowerCase());
        }
        if (drug.getAllergyClassKeywords() != null) {
            drug.getAllergyClassKeywords().replaceAll(k -> k.trim().toLowerCase());
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Register a single drug", description = "Adds a single medicine to the Drug Master collection. Admin only.")
    public ResponseEntity<DrugMaster> createDrug(@RequestBody DrugMaster drug) {
        normalizeDrug(drug);
        return ResponseEntity.ok(drugMasterRepository.save(drug));
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Register multiple drugs in bulk", description = "Adds multiple medicines to the Drug Master collection. Admin only.")
    public ResponseEntity<List<DrugMaster>> createDrugsBulk(@RequestBody List<DrugMaster> drugs) {
        if (drugs != null) {
            drugs.forEach(this::normalizeDrug);
        }
        return ResponseEntity.ok(drugMasterRepository.saveAll(drugs));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','PARAMEDIC','PHYSICIAN','QA_REVIEWER')")
    @Operation(summary = "List all drugs", description = "Returns the entire master list of registered medicines.")
    public ResponseEntity<List<DrugMaster>> getAllDrugs() {
        return ResponseEntity.ok(drugMasterRepository.findAll());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Delete a drug", description = "Deletes a drug from the database. Admin only.")
    public ResponseEntity<Void> deleteDrug(@PathVariable String id) {
        drugMasterRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}

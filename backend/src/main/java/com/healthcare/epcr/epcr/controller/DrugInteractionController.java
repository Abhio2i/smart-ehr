package com.healthcare.epcr.epcr.controller;

import com.healthcare.epcr.epcr.model.DrugInteraction;
import com.healthcare.epcr.epcr.repository.DrugInteractionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drug-interactions")
@RequiredArgsConstructor
@Tag(name = "Drug Interaction Management", description = "Endpoints for managing dynamic drug-drug and class-class interaction rules")
public class DrugInteractionController {

    private final DrugInteractionRepository drugInteractionRepository;

    private void normalizeInteraction(DrugInteraction interaction) {
        if (interaction.getTriggerDrugOrClassA() != null) {
            interaction.setTriggerDrugOrClassA(interaction.getTriggerDrugOrClassA().trim().toLowerCase());
        }
        if (interaction.getTriggerDrugOrClassB() != null) {
            interaction.setTriggerDrugOrClassB(interaction.getTriggerDrugOrClassB().trim().toLowerCase());
        }
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Create an interaction rule", description = "Adds a single drug-drug or class-class interaction warning. Admin only.")
    public ResponseEntity<DrugInteraction> createInteraction(@RequestBody DrugInteraction interaction) {
        normalizeInteraction(interaction);
        return ResponseEntity.ok(drugInteractionRepository.save(interaction));
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Create multiple interaction rules in bulk", description = "Adds multiple interactions to the database. Admin only.")
    public ResponseEntity<List<DrugInteraction>> createInteractionsBulk(@RequestBody List<DrugInteraction> interactions) {
        if (interactions != null) {
            interactions.forEach(this::normalizeInteraction);
        }
        return ResponseEntity.ok(drugInteractionRepository.saveAll(interactions));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','PARAMEDIC','PHYSICIAN','QA_REVIEWER')")
    @Operation(summary = "List all interaction rules", description = "Returns all drug-drug and class-class interaction rules.")
    public ResponseEntity<List<DrugInteraction>> getAllInteractions() {
        return ResponseEntity.ok(drugInteractionRepository.findAll());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PHYSICIAN')")
    @Operation(summary = "Delete an interaction rule", description = "Deletes an interaction rule by ID. Admin only.")
    public ResponseEntity<Void> deleteInteraction(@PathVariable String id) {
        drugInteractionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}

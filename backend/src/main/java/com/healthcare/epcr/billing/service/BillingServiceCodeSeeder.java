package com.healthcare.epcr.billing.service;

import com.healthcare.epcr.billing.model.BillingServiceCode;
import com.healthcare.epcr.billing.model.DiagnosticCode;
import com.healthcare.epcr.billing.repository.BillingServiceCodeRepository;
import com.healthcare.epcr.billing.repository.DiagnosticCodeRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Pre-populates billing_service_codes and diagnostic ICD-10 codes on first boot.
 */
@Component
@RequiredArgsConstructor
public class BillingServiceCodeSeeder {

    private final BillingServiceCodeRepository repository;
    private final DiagnosticCodeRepository diagnosticRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        seedServiceCodes();
        seedDiagnosticCodes();
    }

    private void seedServiceCodes() {
        if (repository.count() > 0) {
            return;
        }

        List<BillingServiceCode> defaults = List.of(
                code("AMB-01", "Standard ground ambulance transport", 450.00, "AMBULANCE", "transport"),
                code("AMB-02", "Air ambulance / medevac transport", 3200.00, "AMBULANCE", "air transport"),
                code("CLN-01", "Clinic consultation - general", 120.00, "CLINIC", "consult"),
                code("CLN-02", "Chest pain / cardiac consult", 180.00, "CLINIC", "chest pain"),
                code("SUP-01", "Oxygen therapy / airway management", 75.00, "SUPPLY", "mechanical ventilation"),
                code("SUP-02", "IV medication administration", 60.00, "SUPPLY", "iv")
        );

        repository.saveAll(defaults);
    }

    private void seedDiagnosticCodes() {
        if (diagnosticRepository.count() > 0) {
            return;
        }

        List<DiagnosticCode> defaults = List.of(
                new DiagnosticCode(null, "R07.9", "Chest Pain, Unspecified"),
                new DiagnosticCode(null, "I21.9", "Acute Myocardial Infarction (Heart Attack)"),
                new DiagnosticCode(null, "I46.9", "Cardiac Arrest, Cause Unspecified"),
                new DiagnosticCode(null, "J45.909", "Asthma, Unspecified, Uncomplicated"),
                new DiagnosticCode(null, "S39.9", "Injury of Abdomen, Lower Back"),
                new DiagnosticCode(null, "G40.909", "Epilepsy, Unspecified, Uncomplicated"),
                new DiagnosticCode(null, "R55", "Syncope and Collapse (Fainting)"),
                new DiagnosticCode(null, "R51.9", "Headache, Unspecified")
        );

        diagnosticRepository.saveAll(defaults);
    }

    private BillingServiceCode code(String code, String desc, double rate, String category, String keyword) {
        BillingServiceCode c = new BillingServiceCode();
        c.setCode(code);
        c.setDescription(desc);
        c.setRate(rate);
        c.setCategory(category);
        c.setActive(true);
        c.setMatchKeyword(keyword);
        return c;
    }
}

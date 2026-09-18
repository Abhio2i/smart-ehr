package com.healthcare.epcr.ophthalmology.service;

import com.healthcare.epcr.ophthalmology.dto.LinkOphthalmicProcedureRequest;
import com.healthcare.epcr.ophthalmology.entity.OphthalmicProcedure;
import com.healthcare.epcr.ophthalmology.repository.OphthalmicProcedureRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Thin service that tags a surgical case as belonging to the Ophthalmology
 * domain. Does NOT re-implement OR scheduling, pre-op checklist, anesthesia
 * or the case lifecycle state machine — those live in SurgicalCaseService.
 */
@Service
@RequiredArgsConstructor
public class OphthalmicProcedureService {

    private final OphthalmicProcedureRepository repository;

    public OphthalmicProcedure link(LinkOphthalmicProcedureRequest request, String organizationId) {

        OphthalmicProcedure link = OphthalmicProcedure.builder()
                .surgicalCaseId(request.getSurgicalCaseId())
                .patientId(request.getPatientId())
                .organizationId(organizationId)
                .category(request.getCategory())
                .eyeSide(request.getEyeSide())
                .notes(request.getNotes())
                .build();

        return repository.save(link);
    }

    public List<OphthalmicProcedure> getByPatient(String patientId) {
        return repository.findByPatientId(patientId);
    }

    public List<OphthalmicProcedure> getBySurgicalCase(String surgicalCaseId) {
        return repository.findBySurgicalCaseId(surgicalCaseId);
    }
}

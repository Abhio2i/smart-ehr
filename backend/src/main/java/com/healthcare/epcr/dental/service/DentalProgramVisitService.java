package com.healthcare.epcr.dental.service;

import com.healthcare.epcr.dental.dto.DentalProgramVisitRequest;
import com.healthcare.epcr.dental.entity.DentalProgramVisit;
import com.healthcare.epcr.dental.repository.DentalProgramVisitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DentalProgramVisitService {

    private final DentalProgramVisitRepository repository;

    public DentalProgramVisit createVisit(DentalProgramVisitRequest request,
                                           String conductedBy, String conductedByName,
                                           String organizationId) {

        DentalProgramVisit visit = DentalProgramVisit.builder()
                .organizationId(organizationId)
                .schoolName(request.getSchoolName())
                .community(request.getCommunity())
                .visitDate(request.getVisitDate())
                .conductedBy(conductedBy)
                .conductedByName(conductedByName)
                .patientIdsScreened(request.getPatientIdsScreened())
                .totalStudentsScreened(request.getTotalStudentsScreened())
                .referralsNeeded(request.getReferralsNeeded())
                .notes(request.getNotes())
                .build();

        return repository.save(visit);
    }

    public Page<DentalProgramVisit> getByOrganization(String organizationId, Pageable pageable) {
        return repository.findByOrganizationId(organizationId, pageable);
    }

    public List<DentalProgramVisit> getByDateRange(String organizationId, LocalDate start, LocalDate end) {
        return repository.findByOrganizationIdAndVisitDateBetween(organizationId, start, end);
    }

    public List<DentalProgramVisit> getBySchool(String schoolName, String organizationId) {
        return repository.findBySchoolNameAndOrganizationId(schoolName, organizationId);
    }
}

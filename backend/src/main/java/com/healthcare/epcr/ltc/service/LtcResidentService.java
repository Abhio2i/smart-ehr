package com.healthcare.epcr.ltc.service;

import com.healthcare.epcr.bed.service.BedService;
import com.healthcare.epcr.ltc.dto.AdmitResidentRequest;
import com.healthcare.epcr.ltc.dto.CarePlanUpdateRequest;
import com.healthcare.epcr.ltc.entity.LtcActivityLog;
import com.healthcare.epcr.ltc.entity.LtcFacility;
import com.healthcare.epcr.ltc.entity.LtcResident;
import com.healthcare.epcr.ltc.repository.LtcActivityLogRepository;
import com.healthcare.epcr.ltc.repository.LtcFacilityRepository;
import com.healthcare.epcr.ltc.repository.LtcResidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LtcResidentService {

    private final LtcResidentRepository residentRepository;
    private final LtcFacilityRepository facilityRepository;
    private final LtcActivityLogRepository activityLogRepository;
    private final MongoTemplate mongoTemplate;
    private final BedService bedService;

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    private static final List<LtcResident.ResidentStatus> ACTIVE_STATUSES = List.of(
        LtcResident.ResidentStatus.ADMITTED,
        LtcResident.ResidentStatus.ACTIVE,
        LtcResident.ResidentStatus.ON_LEAVE
    );

    public LtcResident admit(AdmitResidentRequest req, String organizationId, String actorId) {

        residentRepository.findByPatientIdAndStatusIn(req.getPatientId(), ACTIVE_STATUSES)
            .ifPresent(r -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Patient already has an active LTC admission: " + r.getId());
            });

        // Attempt bed assignment via BedService if available
        String bedId = null;
        try {
            var availableBeds = bedService.getBeds("ADMIN", organizationId, req.getFacilityId(), null).stream()
                    .filter(b -> com.healthcare.epcr.bed.model.BedStatus.AVAILABLE == b.getStatus())
                    .toList();
            if (!availableBeds.isEmpty()) {
                var assignedBed = bedService.assignBed(availableBeds.get(0).getId(), req.getPatientId(), "LTC Resident", 90, actorId);
                bedId = assignedBed.getId();
            }
        } catch (Exception ignored) {
            // Bed assignment optional if facility has custom bed mapping
        }

        LocalDateTime now = LocalDateTime.now();

        LtcResident resident = LtcResident.builder()
            .organizationId(organizationId)
            .patientId(req.getPatientId())
            .facilityId(req.getFacilityId())
            .bedId(bedId)
            .admissionDate(now)
            .admissionType(req.getAdmissionType())
            .status(LtcResident.ResidentStatus.ADMITTED)
            .carePlan(LtcResident.CarePlan.builder()
                .goals(req.getGoals())
                .preferences(req.getPreferences())
                .dietaryRestrictions(req.getDietaryRestrictions())
                .mobilityLevel(req.getMobilityLevel())
                .lastReviewedAt(now)
                .reviewedBy(actorId)
                .nextReviewDue(now.plusDays(90))
                .build())
            .primaryCareTeam(LtcResident.PrimaryCareTeam.builder()
                .physicianOrNpId(req.getPhysicianOrNpId())
                .nurseId(req.getNurseId())
                .build())
            .createdAt(now)
            .updatedAt(now)
            .createdBy(actorId)
            .updatedBy(actorId)
            .build();

        LtcResident saved = residentRepository.save(resident);
        publishAdmitted(saved);
        return saved;
    }

    public Page<LtcResident> listResidents(String organizationId, Pageable pageable) {
        return residentRepository.findByOrganizationId(organizationId, pageable);
    }

    public Page<LtcResident> listFacilityResidents(String organizationId, String facilityId, Pageable pageable) {
        return residentRepository.findByOrganizationIdAndFacilityIdAndStatusIn(organizationId, facilityId, ACTIVE_STATUSES, pageable);
    }

    public LtcResident updateCarePlan(String residentId, CarePlanUpdateRequest req, String actorId) {
        LtcResident resident = getOrThrow(residentId);
        LtcResident.CarePlan.CarePlanBuilder cp = resident.getCarePlan() == null
            ? LtcResident.CarePlan.builder() : resident.getCarePlan().toBuilder();

        if (req.getGoals() != null) cp.goals(req.getGoals());
        if (req.getPreferences() != null) cp.preferences(req.getPreferences());
        if (req.getDietaryRestrictions() != null) cp.dietaryRestrictions(req.getDietaryRestrictions());
        if (req.getMobilityLevel() != null) cp.mobilityLevel(req.getMobilityLevel());
        if (req.getCareNotes() != null) cp.careNotes(req.getCareNotes());

        LocalDateTime now = LocalDateTime.now();
        cp.lastReviewedAt(now).reviewedBy(actorId).nextReviewDue(now.plusDays(90));

        resident.setCarePlan(cp.build());
        resident.setUpdatedAt(now);
        resident.setUpdatedBy(actorId);
        return residentRepository.save(resident);
    }

    public LtcResident discharge(String residentId, LtcResident.ResidentStatus finalStatus, String actorId) {
        LtcResident resident = getOrThrow(residentId);
        if (resident.getStatus() == LtcResident.ResidentStatus.DISCHARGED
            || resident.getStatus() == LtcResident.ResidentStatus.DECEASED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already discharged");
        }

        if (resident.getBedId() != null) {
            try {
                bedService.vacateBed(resident.getBedId());
            } catch (Exception ignored) {
            }
        }

        LocalDateTime now = LocalDateTime.now();
        resident.setStatus(finalStatus != null ? finalStatus : LtcResident.ResidentStatus.DISCHARGED);
        resident.setDischargeDate(now);
        resident.setUpdatedAt(now);
        resident.setUpdatedBy(actorId);
        LtcResident saved = residentRepository.save(resident);
        publishDischarged(saved);
        return saved;
    }

    public LtcResident transferBed(String residentId, String newBedId, String newFacilityId, String actorId) {
        LtcResident resident = getOrThrow(residentId);
        if (!ACTIVE_STATUSES.contains(resident.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot transfer a non-active resident");
        }
        String oldBedId = resident.getBedId();

        if (newBedId != null) {
            try {
                bedService.assignBed(newBedId, resident.getPatientId(), "LTC Resident", 90, actorId);
            } catch (Exception e) {
                // If assigned or not found
            }
        }

        Query query = new Query(Criteria.where("_id").is(residentId).and("version").is(resident.getVersion()));
        Update update = new Update()
            .set("bedId", newBedId)
            .set("facilityId", newFacilityId)
            .set("updatedAt", LocalDateTime.now())
            .set("updatedBy", actorId);

        LtcResident updated = mongoTemplate.findAndModify(query, update, LtcResident.class);
        if (updated == null) {
            if (newBedId != null) {
                try { bedService.vacateBed(newBedId); } catch (Exception ignored) {}
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Concurrent modification, retry");
        }
        if (oldBedId != null) {
            try { bedService.vacateBed(oldBedId); } catch (Exception ignored) {}
        }
        return residentRepository.findById(residentId).orElseThrow();
    }

    public LtcResident getOrThrow(String residentId) {
        return residentRepository.findById(residentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "LTC resident not found: " + residentId));
    }

    public LtcActivityLog logActivity(String residentId, LtcActivityLog log, String actorId) {
        log.setResidentId(residentId);
        log.setLoggedAt(LocalDateTime.now());
        log.setLoggedBy(actorId);
        return activityLogRepository.save(log);
    }

    public Page<LtcActivityLog> listActivityLogs(String residentId, Pageable pageable) {
        return activityLogRepository.findByResidentIdOrderByLoggedAtDesc(residentId, pageable);
    }

    public LtcFacility createFacility(LtcFacility facility, String organizationId) {
        facility.setOrganizationId(organizationId);
        facility.setActive(true);
        if (facility.getId() == null || facility.getId().isBlank()) {
            facility.setId("LTC-FAC-" + (System.currentTimeMillis() % 10000));
        }
        return facilityRepository.save(facility);
    }

    public List<LtcFacility> listFacilities(String organizationId) {
        List<LtcFacility> list = facilityRepository.findByOrganizationId(organizationId);
        if (list.isEmpty()) {
            List<LtcFacility> seed = List.of(
                LtcFacility.builder().id("LTC-FAC-01").organizationId(organizationId).name("Fort Smith Elders Care Home").community("Fort Smith").region("South Slave").bedCapacity(40).currentOccupancy(32).active(true).build(),
                LtcFacility.builder().id("LTC-FAC-02").organizationId(organizationId).name("Yellowknife Senior Care Center").community("Yellowknife").region("North Slave").bedCapacity(60).currentOccupancy(48).active(true).build(),
                LtcFacility.builder().id("LTC-FAC-03").organizationId(organizationId).name("Inuvik Regional Restorative Care").community("Inuvik").region("Beaufort Delta").bedCapacity(25).currentOccupancy(18).active(true).build()
            );
            return facilityRepository.saveAll(seed);
        }
        return list;
    }

    private void publishAdmitted(LtcResident r) {
        if (messagingTemplate != null) {
            try { messagingTemplate.convertAndSend("/topic/ltc/facility/" + r.getFacilityId(), "RESIDENT_ADMITTED:" + r.getId()); } catch (Exception ignored) {}
        }
    }

    private void publishDischarged(LtcResident r) {
        if (messagingTemplate != null) {
            try { messagingTemplate.convertAndSend("/topic/ltc/facility/" + r.getFacilityId(), "RESIDENT_DISCHARGED:" + r.getId()); } catch (Exception ignored) {}
        }
    }
}

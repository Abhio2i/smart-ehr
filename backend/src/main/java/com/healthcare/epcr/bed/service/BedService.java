package com.healthcare.epcr.bed.service;

import com.healthcare.epcr.bed.dto.CreateBedRequest;
import com.healthcare.epcr.bed.model.Bed;
import com.healthcare.epcr.bed.model.BedStatus;
import com.healthcare.epcr.bed.repository.BedRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Production-grade Bed Management Service.
 *
 * Access rules:
 * <ul>
 *   <li>ADMIN  — full access across all organizations</li>
 *   <li>MANAGER / PARAMEDIC — scoped to their own organizationId</li>
 * </ul>
 *
 * No seed/demo data is auto-created. All beds must be registered by staff.
 */
@Service
@RequiredArgsConstructor
public class BedService {

    private static final String ROLE_ADMIN = "ADMIN";

    private final BedRepository bedRepository;
    private final com.healthcare.epcr.notification.repository.NotificationRepository notificationRepository;
    private final com.healthcare.epcr.user.repository.UserRepository userRepository;

    // ── CREATE ────────────────────────────────────────────────────────────────

    /**
     * Register a new bed.
     *
     * @param request      DTO with bedNumber, roomNumber, wardName, facilityName
     * @param createdBy    userId of the authenticated user creating the bed
     * @param organizationId organizationId of the authenticated user
     * @throws IllegalArgumentException if bed number already exists in the facility
     */
    public Bed createBed(CreateBedRequest request, String createdBy, String organizationId) {
        // Duplicate check — same bedNumber + facilityName within an org
        if (bedRepository.existsByBedNumberAndFacilityNameAndOrganizationId(
                request.getBedNumber(), request.getFacilityName(), organizationId)) {
            throw new IllegalArgumentException(
                    "Bed '" + request.getBedNumber() + "' already exists in facility '"
                            + request.getFacilityName() + "'");
        }

        Bed bed = new Bed();
        bed.setBedNumber(request.getBedNumber().trim().toUpperCase());
        bed.setRoomNumber(request.getRoomNumber().trim());
        bed.setWardName(request.getWardName().trim());
        bed.setFacilityName(request.getFacilityName().trim());
        bed.setOrganizationId(organizationId);
        bed.setCreatedBy(createdBy);
        bed.setStatus(BedStatus.AVAILABLE);   // new beds start as available
        bed.setCreatedAt(LocalDateTime.now());
        bed.setUpdatedAt(LocalDateTime.now());

        return bedRepository.save(bed);
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * Fetch beds respecting org-scope.
     *
     * @param role           authenticated user's role (ADMIN / MANAGER / PARAMEDIC …)
     * @param organizationId authenticated user's org (ignored for ADMIN when facility filter present)
     * @param facility       optional facility name filter
     * @param ward           optional ward name filter
     */
    public List<Bed> getBeds(String role, String organizationId, String facility, String ward) {
        boolean isAdmin = ROLE_ADMIN.equalsIgnoreCase(role);

        String wardFilter     = (ward     != null && !ward.trim().isEmpty())     ? ward.trim()     : null;
        String facilityFilter = (facility != null && !facility.trim().isEmpty()) ? facility.trim() : null;

        if (isAdmin) {
            // Admin sees all beds, optionally filtered
            if (facilityFilter != null && wardFilter != null) {
                return bedRepository.findByFacilityNameAndWardName(facilityFilter, wardFilter);
            } else if (facilityFilter != null) {
                return bedRepository.findByFacilityName(facilityFilter);
            }
            return bedRepository.findAll();
        } else {
            // Non-admin: always scoped to their org
            if (wardFilter != null) {
                return bedRepository.findByOrganizationIdAndWardName(organizationId, wardFilter);
            }
            return bedRepository.findByOrganizationId(organizationId);
        }
    }

    // ── STATS ─────────────────────────────────────────────────────────────────

    /**
     * Capacity statistics scoped to the caller's organization (admin gets global stats).
     */
    public Map<String, Object> getCapacityStats(String role, String organizationId) {
        boolean isAdmin = ROLE_ADMIN.equalsIgnoreCase(role);
        List<Bed> all = isAdmin
                ? bedRepository.findAll()
                : bedRepository.findByOrganizationId(organizationId);

        long total       = all.size();
        long occupied    = all.stream().filter(b -> BedStatus.OCCUPIED    == b.getStatus()).count();
        long available   = all.stream().filter(b -> BedStatus.AVAILABLE   == b.getStatus()).count();
        long maintenance = all.stream().filter(b -> BedStatus.MAINTENANCE == b.getStatus()).count();
        double occupancyRate = total > 0 ? ((double) occupied / total) * 100 : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalBeds",       total);
        stats.put("occupiedBeds",    occupied);
        stats.put("availableBeds",   available);
        stats.put("maintenanceBeds", maintenance);
        stats.put("occupancyRate",   Math.round(occupancyRate * 10.0) / 10.0);
        return stats;
    }

    // ── ASSIGN / VACATE / STATUS ──────────────────────────────────────────────

    public Bed assignBed(String bedId, String patientId, String patientName, Integer allottedDays, String assignedBy) {
        Bed bed = findById(bedId);
        
        java.util.Optional<Bed> occupied = bedRepository.findByOccupiedByPatientIdAndStatus(patientId, BedStatus.OCCUPIED);
        if (occupied.isPresent() && !occupied.get().getId().equals(bedId)) {
            throw new IllegalArgumentException("Patient is already assigned to Bed " + occupied.get().getBedNumber() + " (Room " + occupied.get().getRoomNumber() + ")");
        }

        bed.setStatus(BedStatus.OCCUPIED);
        bed.setOccupiedByPatientId(patientId);
        bed.setOccupiedByPatientName(patientName);
        bed.setAssignedAt(LocalDateTime.now());
        
        if (allottedDays != null && allottedDays > 0) {
            bed.setAllottedDays(allottedDays);
            bed.setReleaseDateTime(LocalDateTime.now().plusDays(allottedDays));
        } else {
            bed.setAllottedDays(null);
            bed.setReleaseDateTime(null);
        }
        bed.setAssignedBy(assignedBy);

        bed.setUpdatedAt(LocalDateTime.now());
        return bedRepository.save(bed);
    }

    public Bed vacateBed(String bedId) {
        Bed bed = findById(bedId);
        bed.setStatus(BedStatus.AVAILABLE);
        bed.setOccupiedByPatientId(null);
        bed.setOccupiedByPatientName(null);
        bed.setAssignedAt(null);
        bed.setAllottedDays(null);
        bed.setReleaseDateTime(null);
        bed.setAssignedBy(null);
        bed.setUpdatedAt(LocalDateTime.now());
        return bedRepository.save(bed);
    }

    public Bed updateBedStatus(String bedId, String status) {
        Bed bed = findById(bedId);
        BedStatus newStatus = BedStatus.valueOf(status.toUpperCase());
        bed.setStatus(newStatus);
        if (newStatus != BedStatus.OCCUPIED) {
            bed.setOccupiedByPatientId(null);
            bed.setOccupiedByPatientName(null);
            bed.setAssignedAt(null);
            bed.setAllottedDays(null);
            bed.setReleaseDateTime(null);
            bed.setAssignedBy(null);
        }
        bed.setUpdatedAt(LocalDateTime.now());
        return bedRepository.save(bed);
    }

    @Scheduled(fixedRate = 60000) // runs every 1 minute
    public void checkAndReleaseExpiredBeds() {
        LocalDateTime now = LocalDateTime.now();
        List<Bed> expiredBeds = bedRepository.findByStatusAndReleaseDateTimeBefore(BedStatus.OCCUPIED, now);
        
        for (Bed bed : expiredBeds) {
            String patientName = bed.getOccupiedByPatientName();
            String recipientId = bed.getAssignedBy();
            
            // Vacate bed
            bed.setStatus(BedStatus.AVAILABLE);
            bed.setOccupiedByPatientId(null);
            bed.setOccupiedByPatientName(null);
            bed.setAssignedAt(null);
            bed.setAllottedDays(null);
            bed.setReleaseDateTime(null);
            bed.setAssignedBy(null);
            bed.setUpdatedAt(now);
            bedRepository.save(bed);
            
            // Send in-built notification to the assigning paramedic, all paramedics, and managers of that organization
            java.util.Set<String> recipients = new java.util.HashSet<>();
            if (recipientId != null && !recipientId.trim().isEmpty()) {
                recipients.add(recipientId);
            }
            if (bed.getOrganizationId() != null) {
                List<com.healthcare.epcr.user.model.User> paramedics = userRepository.findByOrganizationIdAndRole(bed.getOrganizationId(), com.healthcare.epcr.user.model.Role.PARAMEDIC);
                List<com.healthcare.epcr.user.model.User> managers = userRepository.findByOrganizationIdAndRole(bed.getOrganizationId(), com.healthcare.epcr.user.model.Role.MANAGER);
                if (paramedics != null) {
                    for (com.healthcare.epcr.user.model.User u : paramedics) {
                        if (u.getId() != null) recipients.add(u.getId());
                    }
                }
                if (managers != null) {
                    for (com.healthcare.epcr.user.model.User u : managers) {
                        if (u.getId() != null) recipients.add(u.getId());
                    }
                }
            }

            for (String recId : recipients) {
                com.healthcare.epcr.notification.model.Notification notification = new com.healthcare.epcr.notification.model.Notification();
                notification.setRecipientId(recId);
                notification.setType("INFO");
                notification.setTitle("Bed Allocation Expired");
                notification.setMessage("Bed " + bed.getBedNumber() + " (Room " + bed.getRoomNumber() + ") has been automatically vacated. Patient " + patientName + "'s allotment has expired.");
                notification.setCreatedAt(now);
                notification.setRead(false);
                notificationRepository.save(notification);
            }
        }
    }

    public Bed simulateExpiry(String bedId) {
        Bed bed = findById(bedId);
        bed.setReleaseDateTime(LocalDateTime.now().minusDays(1));
        return bedRepository.save(bed);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    /**
     * Delete a bed. Non-admin users can only delete beds belonging to their org.
     *
     * @throws IllegalArgumentException if bed not found or access denied
     */
    public void deleteBed(String bedId, String role, String organizationId) {
        Bed bed = findById(bedId);
        boolean isAdmin = ROLE_ADMIN.equalsIgnoreCase(role);
        if (!isAdmin && !organizationId.equals(bed.getOrganizationId())) {
            throw new IllegalArgumentException("Access denied: bed does not belong to your organization.");
        }
        bedRepository.deleteById(bedId);
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    private Bed findById(String bedId) {
        return bedRepository.findById(bedId)
                .orElseThrow(() -> new IllegalArgumentException("Bed not found with ID: " + bedId));
    }
}

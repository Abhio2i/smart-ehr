package com.healthcare.epcr.bed.service;

import com.healthcare.epcr.bed.dto.CreateBedRequest;
import com.healthcare.epcr.bed.model.Bed;
import com.healthcare.epcr.bed.model.BedStatus;
import com.healthcare.epcr.bed.repository.BedRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BedServiceTest {

    @Mock
    private BedRepository bedRepository;

    @Mock
    private com.healthcare.epcr.notification.repository.NotificationRepository notificationRepository;

    @Mock
    private com.healthcare.epcr.user.repository.UserRepository userRepository;

    @InjectMocks
    private BedService bedService;

    private static final String ORG_ID   = "org-001";
    private static final String USER_ID  = "user-001";
    private static final String FACILITY = "Stanton Territorial Hospital";

    private Bed bed;

    @BeforeEach
    void setUp() {
        bed = new Bed();
        bed.setId("bed-1");
        bed.setBedNumber("BED-ICU-101");
        bed.setRoomNumber("RM-101");
        bed.setWardName("ICU");
        bed.setFacilityName(FACILITY);
        bed.setOrganizationId(ORG_ID);
        bed.setStatus(BedStatus.AVAILABLE);
    }

    // ── createBed ─────────────────────────────────────────────────────────────

    @Test
    void testCreateBed_success() {
        CreateBedRequest req = new CreateBedRequest();
        req.setBedNumber("BED-ICU-102");
        req.setRoomNumber("RM-102");
        req.setWardName("ICU");
        req.setFacilityName(FACILITY);

        when(bedRepository.existsByBedNumberAndFacilityNameAndOrganizationId(
                "BED-ICU-102", FACILITY, ORG_ID)).thenReturn(false);
        when(bedRepository.save(any(Bed.class))).thenAnswer(i -> i.getArguments()[0]);

        Bed created = bedService.createBed(req, USER_ID, ORG_ID);

        assertEquals("BED-ICU-102", created.getBedNumber());
        assertEquals(BedStatus.AVAILABLE, created.getStatus());
        assertEquals(ORG_ID, created.getOrganizationId());
        assertEquals(USER_ID, created.getCreatedBy());
        verify(bedRepository, times(1)).save(any());
    }

    @Test
    void testCreateBed_duplicateShouldThrow() {
        CreateBedRequest req = new CreateBedRequest();
        req.setBedNumber("BED-ICU-101");
        req.setRoomNumber("RM-101");
        req.setWardName("ICU");
        req.setFacilityName(FACILITY);

        when(bedRepository.existsByBedNumberAndFacilityNameAndOrganizationId(
                "BED-ICU-101", FACILITY, ORG_ID)).thenReturn(true);

        assertThrows(IllegalArgumentException.class,
                () -> bedService.createBed(req, USER_ID, ORG_ID));
        verify(bedRepository, never()).save(any());
    }

    // ── assignBed / vacateBed ─────────────────────────────────────────────────

    @Test
    void testAssignBed() {
        when(bedRepository.findById("bed-1")).thenReturn(Optional.of(bed));
        when(bedRepository.findByOccupiedByPatientIdAndStatus("PAT-123", BedStatus.OCCUPIED)).thenReturn(Optional.empty());
        when(bedRepository.save(any(Bed.class))).thenAnswer(i -> i.getArguments()[0]);

        Bed result = bedService.assignBed("bed-1", "PAT-123", "Alice", 3, "user-001");

        assertEquals(BedStatus.OCCUPIED, result.getStatus());
        assertEquals("PAT-123", result.getOccupiedByPatientId());
        assertEquals("Alice",   result.getOccupiedByPatientName());
        assertEquals(3,         result.getAllottedDays());
        assertEquals("user-001", result.getAssignedBy());
        assertNotNull(result.getReleaseDateTime());
        assertNotNull(result.getAssignedAt());
    }

    @Test
    void testAssignBed_patientAlreadyAssigned_throws() {
        Bed anotherBed = new Bed();
        anotherBed.setId("bed-2");
        anotherBed.setBedNumber("BED-ICU-102");
        anotherBed.setStatus(BedStatus.OCCUPIED);
        anotherBed.setOccupiedByPatientId("PAT-123");

        when(bedRepository.findById("bed-1")).thenReturn(Optional.of(bed));
        when(bedRepository.findByOccupiedByPatientIdAndStatus("PAT-123", BedStatus.OCCUPIED)).thenReturn(Optional.of(anotherBed));

        assertThrows(IllegalArgumentException.class, () -> bedService.assignBed("bed-1", "PAT-123", "Alice", null, null));
        verify(bedRepository, never()).save(any());
    }

    @Test
    void testVacateBed() {
        bed.setStatus(BedStatus.OCCUPIED);
        bed.setOccupiedByPatientId("PAT-123");
        bed.setOccupiedByPatientName("Alice");

        when(bedRepository.findById("bed-1")).thenReturn(Optional.of(bed));
        when(bedRepository.save(any(Bed.class))).thenAnswer(i -> i.getArguments()[0]);

        Bed result = bedService.vacateBed("bed-1");

        assertEquals(BedStatus.AVAILABLE, result.getStatus());
        assertNull(result.getOccupiedByPatientId());
        assertNull(result.getOccupiedByPatientName());
        assertNull(result.getAssignedAt());
    }

    // ── getBeds (org-scoped) ──────────────────────────────────────────────────

    @Test
    void testGetBeds_managerScopedToOrg() {
        when(bedRepository.findByOrganizationId(ORG_ID)).thenReturn(List.of(bed));

        List<Bed> result = bedService.getBeds("MANAGER", ORG_ID, null, null);

        assertEquals(1, result.size());
        verify(bedRepository).findByOrganizationId(ORG_ID);
        verify(bedRepository, never()).findAll();
    }

    @Test
    void testGetBeds_adminGetsAll() {
        when(bedRepository.findAll()).thenReturn(List.of(bed));

        List<Bed> result = bedService.getBeds("ADMIN", ORG_ID, null, null);

        assertEquals(1, result.size());
        verify(bedRepository).findAll();
    }

    // ── getCapacityStats ──────────────────────────────────────────────────────

    @Test
    void testGetCapacityStats_orgScoped() {
        List<Bed> list = new ArrayList<>();
        Bed b1 = new Bed(); b1.setStatus(BedStatus.AVAILABLE);   list.add(b1);
        Bed b2 = new Bed(); b2.setStatus(BedStatus.OCCUPIED);    list.add(b2);
        Bed b3 = new Bed(); b3.setStatus(BedStatus.MAINTENANCE); list.add(b3);

        when(bedRepository.findByOrganizationId(ORG_ID)).thenReturn(list);

        Map<String, Object> stats = bedService.getCapacityStats("MANAGER", ORG_ID);

        assertEquals(3L,   stats.get("totalBeds"));
        assertEquals(1L,   stats.get("occupiedBeds"));
        assertEquals(1L,   stats.get("availableBeds"));
        assertEquals(1L,   stats.get("maintenanceBeds"));
        assertEquals(33.3, stats.get("occupancyRate"));
    }

    // ── deleteBed ─────────────────────────────────────────────────────────────

    @Test
    void testDeleteBed_success() {
        when(bedRepository.findById("bed-1")).thenReturn(Optional.of(bed));
        doNothing().when(bedRepository).deleteById("bed-1");

        assertDoesNotThrow(() -> bedService.deleteBed("bed-1", "MANAGER", ORG_ID));
        verify(bedRepository).deleteById("bed-1");
    }

    @Test
    void testDeleteBed_wrongOrgShouldThrow() {
        when(bedRepository.findById("bed-1")).thenReturn(Optional.of(bed));

        assertThrows(IllegalArgumentException.class,
                () -> bedService.deleteBed("bed-1", "MANAGER", "other-org"));
        verify(bedRepository, never()).deleteById(any());
    }

    @Test
    void testScheduler_releasesExpiredBeds_andSendsNotification() {
        Bed expiredBed = new Bed();
        expiredBed.setId("bed-expired");
        expiredBed.setBedNumber("BED-ICU-99");
        expiredBed.setRoomNumber("RM-99");
        expiredBed.setWardName("ICU");
        expiredBed.setFacilityName(FACILITY);
        expiredBed.setStatus(BedStatus.OCCUPIED);
        expiredBed.setOccupiedByPatientId("PAT-99");
        expiredBed.setOccupiedByPatientName("Bob");
        expiredBed.setAssignedBy("paramedic-99");
        expiredBed.setReleaseDateTime(LocalDateTime.now().minusMinutes(1));

        when(bedRepository.findByStatusAndReleaseDateTimeBefore(eq(BedStatus.OCCUPIED), any(LocalDateTime.class)))
                .thenReturn(List.of(expiredBed));
        when(bedRepository.save(any(Bed.class))).thenAnswer(i -> i.getArguments()[0]);
        when(notificationRepository.save(any())).thenAnswer(i -> i.getArguments()[0]);

        bedService.checkAndReleaseExpiredBeds();

        assertEquals(BedStatus.AVAILABLE, expiredBed.getStatus());
        assertNull(expiredBed.getOccupiedByPatientId());
        assertNull(expiredBed.getOccupiedByPatientName());
        assertNull(expiredBed.getAssignedBy());
        assertNull(expiredBed.getReleaseDateTime());

        verify(bedRepository, times(1)).save(expiredBed);
        verify(notificationRepository, times(1)).save(any());
    }
}

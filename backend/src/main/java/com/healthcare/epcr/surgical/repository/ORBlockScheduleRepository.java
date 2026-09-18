package com.healthcare.epcr.surgical.repository;

import com.healthcare.epcr.surgical.model.ORBlockSchedule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.DayOfWeek;
import java.util.List;

public interface ORBlockScheduleRepository extends MongoRepository<ORBlockSchedule, String> {

    /** All blocks for an org. */
    List<ORBlockSchedule> findByOrganizationId(String organizationId);

    /** Blocks for a specific OR on a day of week. */
    List<ORBlockSchedule> findByOrIdAndDayOfWeekAndOrganizationId(
            String orId, DayOfWeek dayOfWeek, String organizationId);

    /** All blocks assigned to a specific surgeon. */
    List<ORBlockSchedule> findBySurgeonIdAndOrganizationId(String surgeonId, String organizationId);

    /** Active blocks for an OR. */
    List<ORBlockSchedule> findByOrIdAndOrganizationIdAndActiveTrue(
            String orId, String organizationId);
}

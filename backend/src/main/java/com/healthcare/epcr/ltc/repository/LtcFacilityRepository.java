package com.healthcare.epcr.ltc.repository;

import com.healthcare.epcr.ltc.entity.LtcFacility;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LtcFacilityRepository extends MongoRepository<LtcFacility, String> {
    List<LtcFacility> findByOrganizationIdAndActiveTrue(String organizationId);
    List<LtcFacility> findByOrganizationId(String organizationId);
}

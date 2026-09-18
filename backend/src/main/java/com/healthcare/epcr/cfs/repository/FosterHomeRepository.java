package com.healthcare.epcr.cfs.repository;

import com.healthcare.epcr.cfs.entity.FosterHome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FosterHomeRepository extends MongoRepository<FosterHome, String> {
    Optional<FosterHome> findByHomeLicenseNumber(String homeLicenseNumber);
    List<FosterHome> findByLicenseStatus(String licenseStatus);
    Page<FosterHome> findByRegion(String region, Pageable pageable);
}

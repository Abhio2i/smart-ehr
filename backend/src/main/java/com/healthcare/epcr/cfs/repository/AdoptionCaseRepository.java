package com.healthcare.epcr.cfs.repository;

import com.healthcare.epcr.cfs.entity.AdoptionCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdoptionCaseRepository extends MongoRepository<AdoptionCase, String> {
    Optional<AdoptionCase> findByAdoptionFileNumber(String adoptionFileNumber);
    List<AdoptionCase> findByCfsCaseId(String cfsCaseId);
    Page<AdoptionCase> findByAdoptionType(String adoptionType, Pageable pageable);
}

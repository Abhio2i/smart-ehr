package com.healthcare.epcr.organization.repository;

import com.healthcare.epcr.organization.model.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface OrganizationRepository extends MongoRepository<Organization, String> {
    Optional<Organization> findByCode(String code);
    Optional<Organization> findByEmail(String email);
    Optional<Organization> findByPhone(String phone);
    List<Organization> findByActive(Boolean active);
    Page<Organization> findByActive(Boolean active, Pageable pageable);
}





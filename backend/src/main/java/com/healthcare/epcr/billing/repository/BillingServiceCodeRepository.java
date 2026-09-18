package com.healthcare.epcr.billing.repository;

import com.healthcare.epcr.billing.model.BillingServiceCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface BillingServiceCodeRepository extends MongoRepository<BillingServiceCode, String> {

    Optional<BillingServiceCode> findByCode(String code);

    List<BillingServiceCode> findByActiveTrue();

    List<BillingServiceCode> findByCategory(String category);
}

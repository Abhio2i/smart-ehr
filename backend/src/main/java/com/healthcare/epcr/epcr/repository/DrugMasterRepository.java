package com.healthcare.epcr.epcr.repository;

import com.healthcare.epcr.epcr.model.DrugMaster;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DrugMasterRepository extends MongoRepository<DrugMaster, String> {
    Optional<DrugMaster> findByGenericNameIgnoreCase(String genericName);

    @Query("{ 'brandNames': { $regex: ?0, $options: 'i' } }")
    Optional<DrugMaster> findByBrandName(String brandName);
}

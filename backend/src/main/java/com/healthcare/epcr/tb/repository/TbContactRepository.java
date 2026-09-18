package com.healthcare.epcr.tb.repository;

import com.healthcare.epcr.tb.enums.ContactInvestigationStatus;
import com.healthcare.epcr.tb.enums.ContactRiskLevel;
import com.healthcare.epcr.tb.model.TbContact;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TbContactRepository extends MongoRepository<TbContact, String> {
    List<TbContact> findByIndexCaseId(String indexCaseId);
    List<TbContact> findByIndexCaseIdAndRiskLevel(String indexCaseId, ContactRiskLevel riskLevel);
    long countByOrganizationIdAndInvestigationStatus(String organizationId, ContactInvestigationStatus status);
    long countByOrganizationIdAndRiskLevel(String organizationId, ContactRiskLevel riskLevel);
    long countByIndexCaseId(String indexCaseId);
}

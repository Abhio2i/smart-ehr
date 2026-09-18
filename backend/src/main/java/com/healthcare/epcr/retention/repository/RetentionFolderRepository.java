package com.healthcare.epcr.retention.repository;

import com.healthcare.epcr.retention.model.RetentionFolder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RetentionFolderRepository extends MongoRepository<RetentionFolder, String> {
    List<RetentionFolder> findByOrganizationId(String organizationId);
    List<RetentionFolder> findByOrganizationIdAndParentFolderId(String organizationId, String parentFolderId);
    List<RetentionFolder> findByParentFolderId(String parentFolderId);
}

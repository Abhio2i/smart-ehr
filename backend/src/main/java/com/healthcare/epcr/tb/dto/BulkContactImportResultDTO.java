package com.healthcare.epcr.tb.dto;

import com.healthcare.epcr.tb.model.TbContact;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkContactImportResultDTO {
    private String caseId;
    private int totalRows;
    private int successCount;
    private int failureCount;
    private List<TbContact> createdContacts;
    private List<String> errors;
}

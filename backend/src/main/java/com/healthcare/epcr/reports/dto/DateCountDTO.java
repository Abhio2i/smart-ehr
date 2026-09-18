package com.healthcare.epcr.reports.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DateCountDTO {
    private String date; // "2026-08-19"
    private long count;
}

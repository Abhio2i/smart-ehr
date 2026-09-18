package com.healthcare.epcr.rulesengine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IfThenCondition {
    private String field;
    private String operator; // >=, >, <=, <, =, !=, GTE, GT, LTE, LT, EQ, NEQ
    private String threshold;
}

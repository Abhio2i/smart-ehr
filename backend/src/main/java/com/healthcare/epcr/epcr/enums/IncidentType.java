package com.healthcare.epcr.epcr.enums;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public enum IncidentType {
    GENERAL("GENERAL"),
    CRITICAL_CARE_TRANSFER("CRITICAL_CARE_TRANSFER"),
    ROAD_TRAFFIC_COLLISION("ROAD_TRAFFIC_COLLISION"),
    TRAUMA("TRAUMA"),
    DENTIST("DENTIST"),
    DENTAL("DENTAL"),
    ONCOLOGY("ONCOLOGY"),
    RADIOLOGY("RADIOLOGY"),
    CARDIOLOGY("CARDIOLOGY"),
    RESPIRATORY("RESPIRATORY"),
    NEUROLOGICAL("NEUROLOGICAL"),
    OBSTETRIC("OBSTETRIC"),
    PEDIATRIC("PEDIATRIC"),
    BEHAVIORAL("BEHAVIORAL"),
    CARDIOLOGY_EMERGENCY("CARDIOLOGY_EMERGENCY"),
    CARDIOLOGY_ARRHYTHMIA("CARDIOLOGY_ARRHYTHMIA"),
    CARDIOLOGY_HEART_FAILURE("CARDIOLOGY_HEART_FAILURE"),
    CARDIOLOGY_CONDUCTION("CARDIOLOGY_CONDUCTION"),
    CARDIOLOGY_VASCULAR("CARDIOLOGY_VASCULAR"),
    CARDIAC_CABG("CARDIAC_CABG"),
    CARDIAC_VALVE_REPAIR_REPLACEMENT("CARDIAC_VALVE_REPAIR_REPLACEMENT"),
    CARDIAC_AORTIC_ANEURYSM_DISSECTION("CARDIAC_AORTIC_ANEURYSM_DISSECTION"),
    CARDIAC_HEART_TRANSPLANT("CARDIAC_HEART_TRANSPLANT"),
    CARDIAC_CONGENITAL_DEFECT_SURGERY("CARDIAC_CONGENITAL_DEFECT_SURGERY"),
    ENT_HEAD_NECK_CANCER_SURGERY("ENT_HEAD_NECK_CANCER_SURGERY"),
    ENT_COCHLEAR_IMPLANT_ADVANCED_EAR_SURGERY("ENT_COCHLEAR_IMPLANT_ADVANCED_EAR_SURGERY"),
    ENT_SKULL_BASE_PITUITARY_TUMOR_SURGERY("ENT_SKULL_BASE_PITUITARY_TUMOR_SURGERY"),
    ENT_COMPLEX_AIRWAY_RECONSTRUCTION("ENT_COMPLEX_AIRWAY_RECONSTRUCTION"),
    ENT_ADVANCED_SINUS_ENDOSCOPIC_NASAL_SURGERY("ENT_ADVANCED_SINUS_ENDOSCOPIC_NASAL_SURGERY");

    private final String code;

    IncidentType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static List<String> codes() {
        return Arrays.stream(values())
                .map(IncidentType::getCode)
                .toList();
    }

    public static Optional<IncidentType> from(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        String normalized = normalize(value);
        return Arrays.stream(values())
                .filter(type -> normalize(type.code).equals(normalized) || normalize(type.name()).equals(normalized))
                .findFirst();
    }

    private static String normalize(String value) {
        return value.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
    }
}

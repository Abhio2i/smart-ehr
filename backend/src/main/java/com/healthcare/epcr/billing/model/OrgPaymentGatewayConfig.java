package com.healthcare.epcr.billing.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "org_payment_gateway_configs")
public class OrgPaymentGatewayConfig {

    @Id
    private String id;

    @Indexed(unique = true)
    private String organizationId;

    private String provider; // e.g. "RAZORPAY", "PHONEPE", "CASHFREE"
    private String keyId;
    private String keySecret;
    private String webhookSecret;
    private String merchantId;
    private String razorpayxAccountNumber; // RazorpayX Current A/c Number (UI mein paste karo)
    private String merchantVpa; // Merchant UPI ID (e.g. clinic@upi)

    @Builder.Default
    private Boolean active = true;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public String getKeyId() {
        return keyId;
    }

    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }

    public String getKeySecret() {
        return keySecret;
    }

    public void setKeySecret(String keySecret) {
        this.keySecret = keySecret;
    }

    public String getMerchantVpa() {
        return merchantVpa;
    }

    public void setMerchantVpa(String merchantVpa) {
        this.merchantVpa = merchantVpa;
    }

    public Boolean getActive() {
        return active != null ? active : true;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}

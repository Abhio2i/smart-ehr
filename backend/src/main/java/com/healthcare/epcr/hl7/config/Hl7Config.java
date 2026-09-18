package com.healthcare.epcr.hl7.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.hl7")
@Data
public class Hl7Config {
    private boolean enabled = true;
    private Mllp mllp = new Mllp();

    @Data
    public static class Mllp {
        private int port = 5001;
        private String host = "localhost";
    }
}

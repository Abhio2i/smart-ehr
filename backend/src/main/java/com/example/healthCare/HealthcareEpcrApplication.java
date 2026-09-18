package com.example.healthCare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication(scanBasePackages = {"com.healthcare.epcr", "com.example.healthCare"})
@EnableMongoRepositories(basePackages = "com.healthcare.epcr")
@EnableAsync
@EnableScheduling
public class HealthcareEpcrApplication {

	@PostConstruct
	public void init() {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
	}

	public static void main(String[] args) {
		SpringApplication.run(HealthcareEpcrApplication.class, args);
	}

}

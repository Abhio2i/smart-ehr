package com.healthcare.epcr.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class  SwaggerConfig {
    @Bean
    public OpenAPI healthcareEpcrOpenApi() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Healthcare EPCR Backend API")
                        .description("Electronic Patient Care Record (ePCR), patient history, QA, reporting, workflow, and supporting services API. Bearer authentication accepts staff JWTs for clinical/admin workflows and patient JWTs for patient-portal read-only workflows where supported.")
                        .version("v1")
                        .contact(new Contact()
                                .name("Healthcare EPCR Team"))
                        .license(new License()
                                .name("Proprietary")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName, new SecurityScheme()
                                .name(securitySchemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}



package com.healthcare.epcr.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.util.Arrays;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:5173,https://ihp.ind.in,https://api.ihp.ind.in}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        if (allowedOrigins != null && !allowedOrigins.isBlank()) {
            for (String origin : allowedOrigins.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty()) {
                    if (trimmed.contains("*")) {
                        config.addAllowedOriginPattern(trimmed);
                    } else {
                        config.addAllowedOrigin(trimmed);
                    }
                }
            }
        }
        
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setExposedHeaders(Arrays.asList("Set-Cookie", "Authorization", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        var cors = registry.addMapping("/**")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .exposedHeaders("Set-Cookie", "Authorization", "X-XSRF-TOKEN")
                .allowCredentials(true)
                .maxAge(3600);

        if (allowedOrigins != null && !allowedOrigins.isBlank()) {
            String[] origins = Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toArray(String[]::new);
            cors.allowedOriginPatterns(origins);
        }
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String filesLocation = Path.of("files").toAbsolutePath().normalize().toUri().toString();
        registry.addResourceHandler("/files/**")
                .addResourceLocations(filesLocation);
    }
}



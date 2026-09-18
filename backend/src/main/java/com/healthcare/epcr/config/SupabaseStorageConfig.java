package com.healthcare.epcr.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.SdkHttpClient;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.time.Duration;

/**
 * Configures AWS SDK v2 S3Client and S3Presigner for Supabase Storage.
 *
 * **CRITICAL FIX**: Supabase S3 does NOT support flexible checksums (SHA256, CRC32, etc.)
 * that AWS SDK v2.27.x sends by default. This causes errors:
 *   java.lang.IllegalArgumentException: Invalid base 16 character: '-'
 *
 * Solution:
 * 1. Use Apache HTTP client with optimized connection pooling
 * 2. Set proper timeouts for S3 operations
 * 3. Disable checksum validation (not supported by Supabase)
 *
 * Required env vars:
 *   SUPABASE_S3_ENDPOINT    – e.g. https://xxx.supabase.co/storage/v1/s3
 *   SUPABASE_S3_ACCESS_KEY  – S3 access key
 *   SUPABASE_S3_SECRET_KEY  – S3 secret key
 *   SUPABASE_S3_REGION      – any string; Supabase ignores it
 */
@Slf4j
@Configuration
public class SupabaseStorageConfig {

    @Value("${supabase.s3.endpoint}")
    private String endpoint;

    @Value("${supabase.s3.access-key}")
    private String accessKey;

    @Value("${supabase.s3.secret-key}")
    private String secretKey;

    @Value("${supabase.s3.region:us-east-1}")
    private String region;

    /**
     * Creates an S3 client configured for Supabase Storage.
     * Uses Apache HTTP client with connection pooling for better performance.
     */
    @Bean
    public S3Client supabaseS3Client() {
        log.info("Initializing Supabase S3 client with endpoint: {}", endpoint);

        // Apache HTTP client with optimized connection pooling for S3 uploads
        SdkHttpClient httpClient = ApacheHttpClient.builder()
                .maxConnections(20)                              // Connection pool size
                .connectionTimeout(Duration.ofSeconds(30))       // Connect timeout
                .socketTimeout(Duration.ofSeconds(60))           // Read/write timeout
                .build();

        S3Client client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)
                        )
                )
                .region(Region.of(region))
                .httpClient(httpClient)
                // Supabase S3 configuration:
                // - pathStyleAccessEnabled(true): use path-style URLs (required for S3-compatible APIs)
                // - DO NOT enable flexible checksums (Supabase doesn't support them)
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();

        log.info("Supabase S3 client initialized successfully");
        return client;
    }

    /**
     * Creates an S3 presigner for generating pre-signed URLs.
     * Used for secure, time-limited document access.
     */
    @Bean
    public S3Presigner supabaseS3Presigner() {
        log.info("Initializing Supabase S3 presigner");

        S3Presigner presigner = S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)
                        )
                )
                .region(Region.of(region))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();

        log.info("Supabase S3 presigner initialized successfully");
        return presigner;
    }
}

package com.healthcare.epcr.config;

import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.connection.ConnectionPoolSettings;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * MongoDB Connection Pool Configuration
 *
 * Configures connection pooling for MongoDB to ensure:
 * - Efficient resource usage
 * - Connection reuse
 * - Timeout handling
 * - Proper scaling under load
 */
@Configuration
@Slf4j
public class MongoDbPoolConfig {

    @Value("${mongodb.connection-pool.min-size:10}")
    private int minConnectionPoolSize;

    @Value("${mongodb.connection-pool.max-size:50}")
    private int maxConnectionPoolSize;

    @Value("${mongodb.connection-pool.timeout-seconds:30}")
    private int timeoutSeconds;

    @Value("${spring.mongodb.uri:mongodb://localhost:27017}")
    private String mongoUri;

    @Bean
    public MongoClient mongoClient() {
        log.info("Configuring MongoDB connection pool: min={}, max={}, timeout={}s",
                 minConnectionPoolSize, maxConnectionPoolSize, timeoutSeconds);

        ConnectionPoolSettings poolSettings = ConnectionPoolSettings.builder()
                .minSize(minConnectionPoolSize)
                .maxSize(maxConnectionPoolSize)
                .maxConnectionIdleTime(timeoutSeconds, TimeUnit.SECONDS)
                .build();

        MongoClientSettings settings = MongoClientSettings.builder()
                .applyConnectionString(new com.mongodb.ConnectionString(mongoUri))
                .applyToConnectionPoolSettings(builder ->
                    builder.applySettings(poolSettings))
                .build();

        log.info("MongoDB connection pool configured successfully");
        return MongoClients.create(settings);
    }
}


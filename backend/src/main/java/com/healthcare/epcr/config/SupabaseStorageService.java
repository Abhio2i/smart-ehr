package com.healthcare.epcr.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.ResponseBytes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.IOException;
import java.time.Duration;

/**
 * Service responsible for all Supabase Storage interactions.
 *
 * <p>Uses the AWS SDK v2 S3 client pointed at the Supabase S3-compatible endpoint.
 * All patient documents are stored in a private bucket; public URLs are never
 * exposed directly. Callers receive a short-lived pre-signed URL for secure access.</p>
 *
 * <h3>Key design decisions</h3>
 * <ul>
 *   <li>Private bucket only — HIPAA-sensitive PHI must not be publicly accessible.</li>
 *   <li>Object key: {@code patient-history/{patientId}/{timestamp}-{sanitizedFilename}}</li>
 *   <li>Pre-signed URL TTL is configurable via {@code supabase.s3.signed-url-ttl-minutes}
 *       (default 15 minutes, matching the session idle-timeout).</li>
 *   <li>The bucket name is read from {@code supabase.s3.bucket}.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SupabaseStorageService {

    private final S3Client supabaseS3Client;
    private final S3Presigner supabaseS3Presigner;

    @Value("${supabase.s3.bucket:patient-documents}")
    private String bucket;

    @Value("${supabase.s3.signed-url-ttl-minutes:15}")
    private int signedUrlTtlMinutes;

    // -------------------------------------------------------------------------
    // Upload
    // -------------------------------------------------------------------------

    /**
     * Uploads a {@link MultipartFile} to Supabase Storage.
     *
     * @param patientId the owning patient ID (used as key prefix)
     * @param file      the multipart file to store
     * @return the S3 object key that uniquely identifies this document
     */
    public String uploadFile(String patientId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Document file must not be null or empty");
        }

        String originalName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^A-Za-z0-9._-]", "_");
        String objectKey = "patient-history/" + patientId + "/" + System.currentTimeMillis() + "-" + safeName;

        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .contentType(contentType)
                    .contentLength(file.getSize())
                    .build();

            supabaseS3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("Uploaded document to Supabase Storage: bucket={} key={}", bucket, objectKey);
            return objectKey;

        } catch (IOException e) {
            log.error("Failed to read file input stream for upload: {}", originalName, e);
            throw new IllegalArgumentException("Unable to read document file for upload", e);
        } catch (Exception e) {
            log.error("Failed to upload document to Supabase Storage: bucket={} key={}", bucket, objectKey, e);
            throw new IllegalStateException("Unable to upload document to Supabase Storage", e);
        }
    }

    // -------------------------------------------------------------------------
    // Pre-signed URL (secure temporary access)
    // -------------------------------------------------------------------------

    /**
     * Generates a pre-signed GET URL for the given S3 object key.
     * The URL expires after {@code supabase.s3.signed-url-ttl-minutes} minutes.
     *
     * @param objectKey the S3 object key returned by {@link #uploadFile}
     * @return a time-limited, pre-signed HTTPS URL the client can use to download the file
     */
    public String generateSignedUrl(String objectKey) {
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(signedUrlTtlMinutes))
                    .getObjectRequest(getRequest)
                    .build();

            PresignedGetObjectRequest presigned = supabaseS3Presigner.presignGetObject(presignRequest);
            String url = presigned.url().toString();
            log.debug("Generated signed URL for key={} ttl={}m", objectKey, signedUrlTtlMinutes);
            return url;

        } catch (Exception e) {
            log.error("Failed to generate signed URL for key={}", objectKey, e);
            throw new IllegalStateException("Unable to generate signed URL for document", e);
        }
    }

    public StoredFile downloadFile(String objectKey) {
        if (objectKey == null || objectKey.isBlank() || objectKey.startsWith("/files/")) {
            throw new IllegalArgumentException("Supabase object key is required");
        }
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();
            ResponseBytes<GetObjectResponse> responseBytes = supabaseS3Client.getObjectAsBytes(getRequest);
            GetObjectResponse response = responseBytes.response();
            return new StoredFile(
                    responseBytes.asByteArray(),
                    response.contentType(),
                    response.contentLength()
            );
        } catch (Exception e) {
            log.warn("Could not download document from Supabase Storage: bucket={} key={} error={}",
                    bucket, objectKey, e.getMessage());
            throw new IllegalStateException("Unable to download document from Supabase Storage", e);
        }
    }

    // -------------------------------------------------------------------------
    // Delete
    // -------------------------------------------------------------------------

    /**
     * Deletes the S3 object at the given key.
     * Failures are logged but do NOT bubble up — the document metadata should
     * still be removed from MongoDB even if the storage object cannot be deleted.
     *
     * @param objectKey the S3 object key to delete
     */
    public void deleteFile(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            supabaseS3Client.deleteObject(
                    DeleteObjectRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .build()
            );
            log.info("Deleted document from Supabase Storage: bucket={} key={}", bucket, objectKey);
        } catch (Exception e) {
            // Non-fatal — orphaned S3 objects can be cleaned up via bucket lifecycle rules
            log.warn("Could not delete document from Supabase Storage: bucket={} key={} error={}", bucket, objectKey, e.getMessage());
        }
    }

    public record StoredFile(byte[] bytes, String contentType, Long contentLength) {}
}

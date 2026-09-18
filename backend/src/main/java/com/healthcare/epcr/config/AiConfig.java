package com.healthcare.epcr.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsyncImpl;
import com.openai.client.OpenAIClientImpl;
import com.openai.client.OpenAIClientAsync;
import com.openai.core.ClientOptions;
import com.openai.core.RequestOptions;
import com.openai.core.http.HttpClient;
import com.openai.core.http.HttpRequest;
import com.openai.core.http.HttpRequestBody;
import com.openai.core.http.HttpResponse;
import io.micrometer.observation.ObservationRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.observation.ChatModelObservationConvention;
import org.springframework.ai.model.openai.autoconfigure.OpenAiAutoConfigurationUtil;
import org.springframework.ai.model.openai.autoconfigure.OpenAiChatProperties;
import org.springframework.ai.model.openai.autoconfigure.OpenAiCommonProperties;
import org.springframework.ai.model.tool.DefaultToolExecutionEligibilityPredicate;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionEligibilityPredicate;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Configuration
@EnableConfigurationProperties({ OpenAiCommonProperties.class, OpenAiChatProperties.class })
public class AiConfig {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Bean
    @Primary
    public OpenAiChatModel openAiChatModel(OpenAiCommonProperties commonProperties, OpenAiChatProperties chatProperties,
                                           ToolCallingManager toolCallingManager,
                                           ObjectProvider<ObservationRegistry> observationRegistry,
                                           ObjectProvider<ChatModelObservationConvention> observationConvention,
                                           ObjectProvider<ToolExecutionEligibilityPredicate> openAiToolExecutionEligibilityPredicate) {

        var resolvedProperties = OpenAiAutoConfigurationUtil.resolveCommonProperties(commonProperties, chatProperties);

        log.info("Registering Gemini-compatible OpenAiChatModel with tool response name fixer");

        ClientOptions clientOptions = clientOptions(resolvedProperties);
        OpenAIClient openAIClient = new OpenAIClientImpl(clientOptions);
        OpenAIClientAsync openAIClientAsync = new OpenAIClientAsyncImpl(clientOptions);

        var chatModel = OpenAiChatModel.builder()
                .openAiClient(openAIClient)
                .openAiClientAsync(openAIClientAsync)
                .options(chatProperties.toOptions())
                .toolCallingManager(toolCallingManager)
                .observationRegistry(observationRegistry.getIfUnique(() -> ObservationRegistry.NOOP))
                .toolExecutionEligibilityPredicate(openAiToolExecutionEligibilityPredicate
                        .getIfUnique(DefaultToolExecutionEligibilityPredicate::new))
                .build();

        observationConvention.ifAvailable(chatModel::setObservationConvention);

        return chatModel;
    }

    private ClientOptions clientOptions(OpenAiCommonProperties properties) {
        ClientOptions.Builder builder = ClientOptions.builder()
                .httpClient(geminiFixingHttpClient(properties))
                .baseUrl(baseUrl(properties.getBaseUrl()))
                .timeout(properties.getTimeout())
                .maxRetries(properties.getMaxRetries())
                .putHeader("User-Agent", "spring-ai-openai");

        if (properties.getCredential() != null) {
            builder.credential(properties.getCredential());
        }
        else {
            builder.apiKey(properties.getApiKey());
        }
        if (properties.getOrganizationId() != null) {
            builder.organization(properties.getOrganizationId());
        }
        if (properties.getMicrosoftFoundryServiceVersion() != null) {
            builder.azureServiceVersion(properties.getMicrosoftFoundryServiceVersion());
        }
        if (properties.getCustomHeaders() != null) {
            properties.getCustomHeaders().forEach(builder::putHeader);
        }

        return builder.build();
    }

    private String baseUrl(String baseUrl) {
        return baseUrl == null || baseUrl.isBlank() ? "https://api.openai.com/v1" : baseUrl;
    }

    private HttpClient geminiFixingHttpClient(OpenAiCommonProperties properties) {
        var delegateBuilder = com.openai.client.okhttp.OkHttpClient.builder().timeout(properties.getTimeout());
        if (properties.getProxy() != null) {
            delegateBuilder.proxy(properties.getProxy());
        }
        return new GeminiToolNameFixingHttpClient(delegateBuilder.build());
    }

    private class GeminiToolNameFixingHttpClient implements HttpClient {

        private final HttpClient delegate;

        private GeminiToolNameFixingHttpClient(HttpClient delegate) {
            this.delegate = delegate;
        }

        @Override
        public HttpResponse execute(HttpRequest request, RequestOptions requestOptions) {
            return delegate.execute(fixRequest(request), requestOptions);
        }

        @Override
        public CompletableFuture<HttpResponse> executeAsync(HttpRequest request, RequestOptions requestOptions) {
            return delegate.executeAsync(fixRequest(request), requestOptions);
        }

        @Override
        public void close() {
            delegate.close();
        }

        private HttpRequest fixRequest(HttpRequest request) {
            if (request.body() == null) {
                return request;
            }

            try {
                String originalBody = bodyToString(request.body());
                JsonNode root = objectMapper.readTree(originalBody);
                if (!root.has("messages") || !root.get("messages").isArray()) {
                    return request;
                }

                ArrayNode messages = (ArrayNode) root.get("messages");
                Map<String, String> toolCallIdToName = new HashMap<>();
                for (JsonNode message : messages) {
                    if (message.has("tool_calls") && message.get("tool_calls").isArray()) {
                        for (JsonNode toolCall : message.get("tool_calls")) {
                            String id = toolCall.path("id").asText();
                            String name = toolCall.path("function").path("name").asText();
                            if (!id.isEmpty() && !name.isEmpty()) {
                                toolCallIdToName.put(id, name);
                            }
                        }
                    }
                }

                String onlyDeclaredToolName = onlyDeclaredToolName(root);
                boolean modified = false;
                for (JsonNode message : messages) {
                    if ("tool".equals(message.path("role").asText())) {
                        String toolCallId = message.path("tool_call_id").asText();
                        String name = message.path("name").asText();
                        if ((name == null || name.trim().isEmpty() || "null".equals(name)) && !toolCallId.isEmpty()) {
                            String resolvedName = toolCallIdToName.get(toolCallId);
                            if ((resolvedName == null || resolvedName.isEmpty()) && toolCallIdToName.size() == 1) {
                                resolvedName = toolCallIdToName.values().iterator().next();
                            }
                            if ((resolvedName == null || resolvedName.isEmpty()) && onlyDeclaredToolName != null) {
                                resolvedName = onlyDeclaredToolName;
                            }
                            if (resolvedName != null && !resolvedName.isEmpty()) {
                                ((ObjectNode) message).put("name", resolvedName);
                                modified = true;
                                log.info("Injected missing tool response name '{}' for tool_call_id '{}' in Gemini request payload",
                                        resolvedName, toolCallId);
                            }
                        }
                    }
                }

                if (!modified) {
                    return request;
                }

                byte[] newBody = objectMapper.writeValueAsBytes(root);
                return request.toBuilder().body(new ByteArrayHttpRequestBody(newBody, request.body().contentType())).build();
            }
            catch (Exception e) {
                log.warn("Failed to parse/modify Gemini request payload: {}", e.getMessage());
                return request;
            }
        }

        private String bodyToString(HttpRequestBody body) {
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            body.writeTo(outputStream);
            return outputStream.toString(StandardCharsets.UTF_8);
        }

        private String onlyDeclaredToolName(JsonNode root) {
            JsonNode tools = root.path("tools");
            if (!tools.isArray() || tools.size() != 1) {
                return null;
            }
            String name = tools.get(0).path("function").path("name").asText();
            return name.isBlank() ? null : name;
        }
    }

    private record ByteArrayHttpRequestBody(byte[] content, String contentType) implements HttpRequestBody {

        @Override
        public void writeTo(OutputStream outputStream) {
            try {
                outputStream.write(content);
            }
            catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }

        @Override
        public long contentLength() {
            return content.length;
        }

        @Override
        public boolean repeatable() {
            return true;
        }

        @Override
        public void close() {
        }
    }
}

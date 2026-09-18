package com.healthcare.epcr.chatbot.memory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.SerializationException;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class RedisChatMemory implements ChatMemory {

    private static final String PREFIX = "chat:memory:";

    private final RedisTemplate<String, Object> redisTemplate;

    public RedisChatMemory(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public static class MessageDto implements Serializable {
        private static final long serialVersionUID = 1L;
        private String type;
        private String content;

        public MessageDto() {}

        public MessageDto(String type, String content) {
            this.type = type;
            this.content = content;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    @Override
    public void add(String conversationId, List<Message> messages) {
        String key = key(conversationId);
        List<MessageDto> existing = getAllDtos(conversationId);
        for (Message msg : messages) {
            if (msg != null) {
                String typeStr = msg.getMessageType() != null ? msg.getMessageType().name() : "USER";
                existing.add(new MessageDto(typeStr, msg.getText()));
            }
        }
        try {
            redisTemplate.opsForValue().set(key, existing);
        } catch (Exception e) {
            log.warn("Failed to save chat memory for conversation={}: {}", conversationId, e.getMessage());
        }
    }

    @Override
    public List<Message> get(String conversationId) {
        List<MessageDto> dtos = getAllDtos(conversationId);
        List<Message> messages = new ArrayList<>();
        for (MessageDto dto : dtos) {
            if (dto != null) {
                messages.add(toMessage(dto));
            }
        }
        return messages;
    }

    @Override
    public void clear(String conversationId) {
        redisTemplate.delete(key(conversationId));
    }

    private Message toMessage(MessageDto dto) {
        String type = dto.getType() != null ? dto.getType().toUpperCase() : "USER";
        String content = dto.getContent() != null ? dto.getContent() : "";
        return switch (type) {
            case "USER" -> new UserMessage(content);
            case "ASSISTANT" -> new AssistantMessage(content);
            case "SYSTEM" -> new SystemMessage(content);
            default -> new UserMessage(content);
        };
    }

    @SuppressWarnings("unchecked")
    private List<MessageDto> getAllDtos(String conversationId) {
        String key = key(conversationId);
        try {
            Object value = redisTemplate.opsForValue().get(key);
            if (value instanceof List<?> list) {
                List<MessageDto> dtos = new ArrayList<>();
                for (Object item : list) {
                    if (item instanceof MessageDto dto) {
                        dtos.add(dto);
                    } else if (item instanceof Map<?, ?> map) {
                        String type = (String) map.get("type");
                        String content = (String) map.get("content");
                        dtos.add(new MessageDto(type, content));
                    }
                }
                return dtos;
            }
        } catch (SerializationException | ClassCastException e) {
            // Stale/incompatible/corrupted data in Redis
            log.warn("Corrupted chat memory for conversation={}, clearing and starting fresh. Cause: {}",
                    conversationId, e.getMessage());
            redisTemplate.delete(key);
        } catch (Exception e) {
            log.warn("Failed to read chat memory for conversation={}: {}", conversationId, e.getMessage());
        }
        return new ArrayList<>();
    }

    private String key(String conversationId) {
        return PREFIX + conversationId;
    }
}

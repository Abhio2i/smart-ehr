package com.healthcare.epcr.auditlog.aspect;

import com.healthcare.epcr.auditlog.model.AuditLog;
import com.healthcare.epcr.auditlog.repository.AuditLogRepository;
import com.healthcare.epcr.epcr.dto.PatientCareRecordDTO;
import com.healthcare.epcr.qa.model.QAReview;
import com.healthcare.epcr.user.model.User;
import com.healthcare.epcr.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Aspect
@Component
@RequiredArgsConstructor
public class AuditLoggingAspect {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @AfterReturning(
            pointcut = "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.createRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.updateRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.submitRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.deleteRecord(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.createQAReview(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.completeQAReview(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.deleteQAReview(..))",
            returning = "result")
    public void logSuccess(JoinPoint joinPoint, Object result) {
        writeLog(joinPoint, result, "SUCCESS", null);
    }

    @AfterThrowing(
            pointcut = "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.createRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.updateRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.submitRecord(..)) || " +
                    "execution(* com.healthcare.epcr.epcr.service.impl.PatientCareRecordServiceImpl.deleteRecord(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.createQAReview(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.completeQAReview(..)) || " +
                    "execution(* com.healthcare.epcr.qa.service.QAService.deleteQAReview(..))",
            throwing = "ex")
    public void logFailure(JoinPoint joinPoint, Throwable ex) {
        writeLog(joinPoint, null, "FAILED", ex.getMessage());
    }

    @AfterReturning(
            pointcut = "execution(* com.healthcare.epcr..controller..*(..)) && " +
                    "(@annotation(postMapping) || @annotation(putMapping) || @annotation(patchMapping) || @annotation(deleteMapping))",
            returning = "result")
    public void logControllerWriteSuccess(JoinPoint joinPoint,
                                          PostMapping postMapping,
                                          PutMapping putMapping,
                                          PatchMapping patchMapping,
                                          DeleteMapping deleteMapping,
                                          Object result) {
        if (shouldSkipControllerAudit(joinPoint)) {
            return;
        }
        writeControllerLog(joinPoint, "SUCCESS", null);
    }

    @AfterReturning(
            pointcut = "execution(* com.healthcare.epcr..controller..*(..)) && @annotation(requestMapping)",
            returning = "result")
    public void logControllerRequestMappingWriteSuccess(JoinPoint joinPoint, RequestMapping requestMapping, Object result) {
        if (shouldSkipControllerAudit(joinPoint) || !isWriteRequestMapping(requestMapping)) {
            return;
        }
        writeControllerLog(joinPoint, "SUCCESS", null);
    }

    @AfterThrowing(
            pointcut = "execution(* com.healthcare.epcr..controller..*(..)) && " +
                    "(@annotation(postMapping) || @annotation(putMapping) || @annotation(patchMapping) || @annotation(deleteMapping))",
            throwing = "ex")
    public void logControllerWriteFailure(JoinPoint joinPoint,
                                          PostMapping postMapping,
                                          PutMapping putMapping,
                                          PatchMapping patchMapping,
                                          DeleteMapping deleteMapping,
                                          Throwable ex) {
        if (shouldSkipControllerAudit(joinPoint)) {
            return;
        }
        writeControllerLog(joinPoint, "FAILED", ex.getMessage());
    }

    @AfterThrowing(
            pointcut = "execution(* com.healthcare.epcr..controller..*(..)) && @annotation(requestMapping)",
            throwing = "ex")
    public void logControllerRequestMappingWriteFailure(JoinPoint joinPoint,
                                                        RequestMapping requestMapping,
                                                        Throwable ex) {
        if (shouldSkipControllerAudit(joinPoint) || !isWriteRequestMapping(requestMapping)) {
            return;
        }
        writeControllerLog(joinPoint, "FAILED", ex.getMessage());
    }

    private void writeLog(JoinPoint joinPoint, Object result, String status, String error) {
        String method = joinPoint.getSignature().getName();
        String action = mapAction(method);
        String entityType = mapEntityType(method);
        String entityId = resolveEntityId(method, joinPoint.getArgs(), result);

        AuditLog log = AuditLog.builder()
            .timestamp(LocalDateTime.now())
            .action(action)
            .entityType(entityType)
            .entityId(entityId)
            .status(status)
            .userId(resolveUserId())
            .userDisplayName(resolveUserDisplayName())
            .ipAddress(resolveIpAddress())
            .details(error == null ? "OK" : error)
            .changesMade(buildDetails(method, entityId))
            .build();
        auditLogRepository.save(log);
    }

    private void writeControllerLog(JoinPoint joinPoint, String status, String error) {
        String method = joinPoint.getSignature().getName();
        String controllerName = joinPoint.getSignature().getDeclaringType().getSimpleName();
        String action = mapControllerAction(joinPoint, method);
        String entityId = resolveEntityId(method, joinPoint.getArgs(), null);

        AuditLog log = AuditLog.builder()
            .timestamp(LocalDateTime.now())
            .action(action)
            .entityType(controllerName)
            .entityId(entityId)
            .status(status)
            .userId(resolveUserId())
            .userDisplayName(resolveUserDisplayName())
            .ipAddress(resolveIpAddress())
            .details(error == null ? "OK" : error)
            .changesMade(buildDetails(method, entityId))
            .build();
        auditLogRepository.save(log);
    }

    private String mapControllerAction(JoinPoint joinPoint, String method) {
        if (joinPoint.getSignature() instanceof MethodSignature methodSignature) {
            if (methodSignature.getMethod().isAnnotationPresent(PostMapping.class)) {
                return "CREATE_" + method.toUpperCase();
            }
            if (methodSignature.getMethod().isAnnotationPresent(PutMapping.class)
                    || methodSignature.getMethod().isAnnotationPresent(PatchMapping.class)) {
                return "UPDATE_" + method.toUpperCase();
            }
            if (methodSignature.getMethod().isAnnotationPresent(DeleteMapping.class)) {
                return "DELETE_" + method.toUpperCase();
            }
            RequestMapping requestMapping = methodSignature.getMethod().getAnnotation(RequestMapping.class);
            if (requestMapping != null) {
                for (RequestMethod requestMethod : requestMapping.method()) {
                    if (requestMethod == RequestMethod.POST) {
                        return "CREATE_" + method.toUpperCase();
                    }
                    if (requestMethod == RequestMethod.PUT || requestMethod == RequestMethod.PATCH) {
                        return "UPDATE_" + method.toUpperCase();
                    }
                    if (requestMethod == RequestMethod.DELETE) {
                        return "DELETE_" + method.toUpperCase();
                    }
                }
            }
        }

        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttrs) {
            String httpMethod = servletAttrs.getRequest().getMethod();
            if ("POST".equalsIgnoreCase(httpMethod)) {
                return "CREATE_" + method.toUpperCase();
            }
            if ("PUT".equalsIgnoreCase(httpMethod) || "PATCH".equalsIgnoreCase(httpMethod)) {
                return "UPDATE_" + method.toUpperCase();
            }
            if ("DELETE".equalsIgnoreCase(httpMethod)) {
                return "DELETE_" + method.toUpperCase();
            }
        }
        return "WRITE_" + method.toUpperCase();
    }

    private boolean shouldSkipControllerAudit(JoinPoint joinPoint) {
        String declaringType = joinPoint.getSignature().getDeclaringTypeName();
        return declaringType.endsWith(".auditlog.controller.AuditLogController")
                || declaringType.endsWith(".auth.controller.AuthController");
    }

    private boolean isWriteRequestMapping(RequestMapping requestMapping) {
        if (requestMapping == null || requestMapping.method().length == 0) {
            return false;
        }
        for (RequestMethod method : requestMapping.method()) {
            if (method == RequestMethod.POST
                    || method == RequestMethod.PUT
                    || method == RequestMethod.PATCH
                    || method == RequestMethod.DELETE) {
                return true;
            }
        }
        return false;
    }

    private String resolveUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank() || "anonymousUser".equals(auth.getName())) {
            return "SYSTEM";
        }
        return userRepository.findByEmail(auth.getName())
                .map(User::getId)
                .orElse("SYSTEM");
    }

    private String resolveUserDisplayName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank() || "anonymousUser".equals(auth.getName())) {
            return "SYSTEM";
        }
        return userRepository.findByEmail(auth.getName())
                .map(u -> {
                    String first = u.getFirstName() == null ? "" : u.getFirstName().trim();
                    String last = u.getLastName() == null ? "" : u.getLastName().trim();
                    String full = (first + " " + last).trim();
                    return full.isEmpty() ? u.getEmail() : full;
                })
                .orElse("SYSTEM");
    }

    private String resolveIpAddress() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttrs) {
            HttpServletRequest request = servletAttrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            return request.getRemoteAddr();
        }
        return "N/A";
    }

    private String resolveEntityId(String method, Object[] args, Object result) {
        if (result instanceof PatientCareRecordDTO dto) {
            return dto.getId();
        }
        if (result instanceof QAReview review) {
            return review.getId();
        }
        if (args != null && args.length > 0 && args[0] instanceof String id) {
            if ("updateRecord".equals(method) || "submitRecord".equals(method) || "deleteRecord".equals(method)
                    || "completeQAReview".equals(method) || "deleteQAReview".equals(method)) {
                return id;
            }
        }
        return null;
    }

    private String mapAction(String method) {
        return switch (method) {
            case "createRecord" -> "CREATE_RECORD";
            case "updateRecord" -> "UPDATE_RECORD";
            case "submitRecord" -> "SUBMIT_RECORD";
            case "deleteRecord" -> "DELETE_RECORD";
            case "createQAReview" -> "CREATE_QA_REVIEW";
            case "completeQAReview" -> "QA_COMPLETED";
            case "deleteQAReview" -> "DELETE_QA_REVIEW";
            default -> method.toUpperCase();
        };
    }

    private String mapEntityType(String method) {
        return switch (method) {
            case "createRecord", "updateRecord", "submitRecord", "deleteRecord" -> "PATIENT_CARE_RECORD";
            case "createQAReview", "completeQAReview", "deleteQAReview" -> "QA_REVIEW";
            default -> "SYSTEM";
        };
    }

    private String buildDetails(String method, String entityId) {
        if (entityId == null || entityId.isBlank()) {
            return method;
        }
        return method + " id=" + entityId;
    }
}

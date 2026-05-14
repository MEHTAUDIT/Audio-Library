package com.audiolibrary.config;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler that catches all exceptions and returns structured error responses.
 * <p>
 * All exceptions are logged with full context including:
 * - Tenant ID
 * - User ID
 * - Trace ID
 * - Request details
 * - Stack trace (for errors)
 * <p>
 * Error responses follow a consistent structure:
 * {
 * "timestamp": "2024-01-15T10:30:00",
 * "status": 400,
 * "error": "Bad Request",
 * "code": "validation_error",
 * "message": "Invalid request parameters",
 * "traceId": "abc-123-def",
 * "path": "/api/v1/audio"
 * }
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handle validation errors (e.g., @Valid, @NotNull, @Size).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(
            MethodArgumentNotValidException ex,
            WebRequest request
    ) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        error -> error.getDefaultMessage() != null ? error.getDefaultMessage() : "Invalid value",
                        (existing, replacement) -> existing
                ));

        log.warn("Validation error: fields={} tenant={} user={} path={}",
                fieldErrors.keySet(),
                MDC.get("tenant_id"),
                MDC.get("user_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "validation_error",
                "Invalid request parameters: " + fieldErrors.keySet(),
                request,
                fieldErrors
        );
    }

    /**
     * Handle illegal argument exceptions (business logic validation).
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(
            IllegalArgumentException ex,
            WebRequest request
    ) {
        log.warn("Illegal argument: message='{}' tenant={} user={} path={}",
                ex.getMessage(),
                MDC.get("tenant_id"),
                MDC.get("user_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "bad_request",
                ex.getMessage(),
                request
        );
    }

    /**
     * Handle authentication failures (invalid credentials).
     */
    @ExceptionHandler({BadCredentialsException.class, UsernameNotFoundException.class})
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(
            RuntimeException ex,
            WebRequest request
    ) {
        log.warn("Authentication failed: type={} tenant={} path={}",
                ex.getClass().getSimpleName(),
                MDC.get("tenant_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.UNAUTHORIZED,
                "unauthorized",
                "Invalid credentials",
                request
        );
    }

    /**
     * Handle authorization failures (insufficient permissions).
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(
            AccessDeniedException ex,
            WebRequest request
    ) {
        log.warn("Access denied: message='{}' user={} tenant={} path={}",
                ex.getMessage(),
                MDC.get("user_id"),
                MDC.get("tenant_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.FORBIDDEN,
                "forbidden",
                "You don't have permission to access this resource",
                request
        );
    }

    /**
     * Handle S3 exceptions (storage failures).
     */
    @ExceptionHandler(S3Exception.class)
    public ResponseEntity<Map<String, Object>> handleS3Exception(
            S3Exception ex,
            WebRequest request
    ) {
        log.error("S3 operation failed: statusCode={} errorCode={} message='{}' tenant={} path={}",
                ex.statusCode(),
                ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorCode() : "unknown",
                ex.getMessage(),
                MDC.get("tenant_id"),
                getRequestPath(request),
                ex);

        return buildErrorResponse(
                HttpStatus.SERVICE_UNAVAILABLE,
                "storage_error",
                "File storage service is temporarily unavailable. Please try again later.",
                request
        );
    }

    /**
     * Handle database exceptions (connection failures, constraint violations).
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessException(
            DataAccessException ex,
            WebRequest request
    ) {
        log.error("Database operation failed: type={} message='{}' tenant={} path={}",
                ex.getClass().getSimpleName(),
                ex.getMessage(),
                MDC.get("tenant_id"),
                getRequestPath(request),
                ex);

        String message = "Database operation failed";
        String code = "database_error";

        // Provide more specific error for constraint violations
        if (ex instanceof DataIntegrityViolationException) {
            message = "Data integrity constraint violation. This resource may already exist or has invalid references.";
            code = "constraint_violation";
            log.warn("Data integrity violation detected - possible duplicate or invalid FK reference");
        }

        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                code,
                message,
                request
        );
    }

    /**
     * Handle file upload size exceeded.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex,
            WebRequest request
    ) {
        log.warn("File upload size exceeded: maxSize={} tenant={} user={} path={}",
                ex.getMaxUploadSize(),
                MDC.get("tenant_id"),
                MDC.get("user_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "file_too_large",
                "File size exceeds maximum allowed size of " + (ex.getMaxUploadSize() / (1024 * 1024)) + "MB",
                request
        );
    }

    /**
     * Handle malformed JSON requests.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleHttpMessageNotReadableException(
            HttpMessageNotReadableException ex,
            WebRequest request
    ) {
        log.warn("Malformed request body: message='{}' tenant={} path={}",
                ex.getMessage(),
                MDC.get("tenant_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "malformed_request",
                "Request body is malformed or invalid JSON",
                request
        );
    }

    /**
     * Handle missing required request parameters.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameterException(
            MissingServletRequestParameterException ex,
            WebRequest request
    ) {
        log.warn("Missing required parameter: param={} type={} tenant={} path={}",
                ex.getParameterName(),
                ex.getParameterType(),
                MDC.get("tenant_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "missing_parameter",
                "Required parameter '" + ex.getParameterName() + "' is missing",
                request
        );
    }

    /**
     * Handle type mismatch errors (e.g., passing string where UUID expected).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatchException(
            MethodArgumentTypeMismatchException ex,
            WebRequest request
    ) {
        log.warn("Type mismatch: param={} providedValue={} expectedType={} tenant={} path={}",
                ex.getName(),
                ex.getValue(),
                ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown",
                MDC.get("tenant_id"),
                getRequestPath(request));

        return buildErrorResponse(
                HttpStatus.BAD_REQUEST,
                "type_mismatch",
                String.format("Parameter '%s' has invalid type. Expected %s",
                        ex.getName(),
                        ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "unknown"),
                request
        );
    }

    /**
     * Handle not found errors (e.g., tenant, audio file, or resource not found).
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(
            RuntimeException ex,
            WebRequest request
    ) {
        String message = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (message.contains("not found")) {
            log.warn("Resource not found: message='{}' tenant={} user={} path={}",
                    ex.getMessage(),
                    MDC.get("tenant_id"),
                    MDC.get("user_id"),
                    getRequestPath(request));

            return buildErrorResponse(
                    HttpStatus.NOT_FOUND,
                    "not_found",
                    ex.getMessage(),
                    request
            );
        }

        // Fall through to generic 500 for other RuntimeExceptions
        log.error("Unhandled runtime exception: type={} message='{}' tenant={} user={} path={}",
                ex.getClass().getName(),
                ex.getMessage(),
                MDC.get("tenant_id"),
                MDC.get("user_id"),
                getRequestPath(request),
                ex);

        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "internal_error",
                "An unexpected error occurred. Please try again later.",
                request
        );
    }

    /**
     * Handle all other uncaught exceptions.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(
            Exception ex,
            WebRequest request
    ) {
        log.error("Unhandled exception: type={} message='{}' tenant={} user={} path={}",
                ex.getClass().getName(),
                ex.getMessage(),
                MDC.get("tenant_id"),
                MDC.get("user_id"),
                getRequestPath(request),
                ex);

        return buildErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "internal_error",
                "An unexpected error occurred. Please try again later.",
                request
        );
    }

    /**
     * Build standardized error response with full context.
     */
    private ResponseEntity<Map<String, Object>> buildErrorResponse(
            HttpStatus status,
            String code,
            String message,
            WebRequest request
    ) {
        return buildErrorResponse(status, code, message, request, null);
    }

    /**
     * Build standardized error response with additional details.
     */
    private ResponseEntity<Map<String, Object>> buildErrorResponse(
            HttpStatus status,
            String code,
            String message,
            WebRequest request,
            Object details
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("code", code);
        body.put("message", message);
        body.put("traceId", MDC.get("trace_id"));
        body.put("path", getRequestPath(request));

        if (details != null) {
            body.put("details", details);
        }

        // Add tenant context for debugging (only in non-prod)
        String tenantId = MDC.get("tenant_id");
        if (tenantId != null) {
            body.put("tenantId", tenantId);
        }

        return ResponseEntity.status(status).body(body);
    }

    /**
     * Extract request path from WebRequest.
     */
    private String getRequestPath(WebRequest request) {
        return request.getDescription(false).replace("uri=", "");
    }
}

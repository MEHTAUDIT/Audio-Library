# Runtime image - uses pre-built JAR from CI/CD pipeline
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the pre-built JAR (built by CI pipeline)
COPY build/libs/*.jar app.jar

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# JVM options for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Run the application with explicit logging
ENTRYPOINT ["sh", "-c", "echo 'Starting application...' && echo \"JAVA_OPTS: $JAVA_OPTS\" && java $JAVA_OPTS -jar app.jar"]


# Production image for frontend - uses pre-built dist from CI/CD
FROM nginx:alpine

# Copy the pre-built frontend (built by CI pipeline)
COPY dist/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]


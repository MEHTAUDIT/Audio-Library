# Audio Library Project Architecture

## Overview
A multi-tenant SaaS audio library platform allowing users to stream, download, and manage audio content. The system serves three distinct user groups: End Users (listeners), Tenants (admins), and the Platform Owner.

## Tech Stack
- **Frontend**: React (User, Admin, Owner portals)
- **Backend**: Java Spring Boot
- **Database**: PostgreSQL
- **Infrastructure**: AWS (via IaC - Terraform/CDK)
- **Storage**: AWS S3
- **Authentication**: OAuth2 / OIDC (e.g., AWS Cognito or Keycloak)

## Core Features & Requirements

### 1. Multi-Tenancy
- **Isolation**: Strong isolation between tenants. Usage of one tenant must not affect others.
- **Strategy**: Database schema-per-tenant or Row-level security (Discriminator) with robust indexing. Given the "custom domain" and "isolation" requirements, a Hybrid approach (Shared DB, separate schemas) or distinct databases for large tenants is recommended.
- **Resolution**: Tenant resolution via Subdomain (e.g., `tenant1.audiolib.com`) or Custom Domain.

### 2. User Portal (Listeners)
- **Search**: Advanced search by speaker, date, topic (Elasticsearch/OpenSearch integration recommended for scale).
- **Streaming**: HLS/DASH streaming for adaptive bitrate.
- **Interaction**: Playlists, Favorites, Playback Speed, Recommendations (Trending).
- **Downloads**: Secure, signed URL downloads.

### 3. Admin Portal (Tenant Management)
- **Content Mgmt**: Upload, Categorize, Metadata management.
- **Processing**: Audio enhancement tools.
- **AI Integration**: Auto-summarization and auto-categorization using LLMs/Transcription services (e.g., AWS Transcribe + Bedrock).
- **Analytics**: Usage stats, bandwidth monitoring.
- **Billing**: Subscription management (Stripe integration).
- **Configuration**: Custom domain setup, Branding.

### 4. Owner Portal (Super Admin)
- **Global Metrics**: Total storage, global active users, revenue.
- **Tenant Oversight**: Per-tenant usage monitoring (GB stored, bandwidth).

## Infrastructure & Scalability
- **Compute**: AWS ECS (Fargate) or EKS for containerized Spring Boot services. Auto-scaling enabled.
- **Database**: Amazon RDS for PostgreSQL.
- **Storage**: Amazon S3 for audio files. Lifecycle policies for cost optimization.
- **CDN**: CloudFront for caching static assets and audio streams to reduce latency and backend load.
- **AI/ML**: AWS Lambda for triggering AI processing jobs asynchronously.

## Baseline Capacity & Scaling
- **Baseline**: 500 users streaming 1h/day, 250 downloads/day per tenant.
- **Scaling**: 
  - Horizontal scaling of backend services.
  - Read replicas for Database.
  - CDN offloading for media.

## Data Flow
1. **Upload**: Admin uploads -> S3 (Raw) -> Lambda Trigger -> Processing (Transcode/AI) -> S3 (Processed) -> DB Metadata Update.
2. **Stream**: User Request -> CloudFront -> S3 (Signed URL).
3. **Search**: User Request -> Backend -> Search Index (OpenSearch).


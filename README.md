# Audio Library Platform

A multi-tenant SaaS audio library platform allowing users to stream, download, and manage audio content.

## Tech Stack

- **Backend**: Java 21, Spring Boot 3.2, Gradle
- **Frontend**: React 18, Vite, TypeScript
- **Database**: PostgreSQL (prod) / H2 In-Memory (local)
- **Infrastructure**: AWS (Terraform)

## Prerequisites

- **Java 21** (or higher) - [Download](https://adoptium.net/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **JAVA_HOME** environment variable set to your JDK installation

Verify installations:
```bash
java -version    # Should show 21+
node -version    # Should show 18+
```

---

## Quick Start (Local Development)

### 1. Start the Backend

```powershell
cd backend
gradlew bootRun
```

The backend will start on **http://localhost:8080**

> **Note**: The local profile uses H2 in-memory database, so data resets on restart.

### 2. Start the Frontend

Open a **new terminal**:

```powershell
cd frontend
npm install       # First time only
npm run dev
```

The frontend will start on **http://localhost:5173**

---

## URLs

| Service         | URL                                  | Description                     |
|-----------------|--------------------------------------|---------------------------------|
| Frontend        | http://localhost:5173                | React UI                        |
| Backend API     | http://localhost:8080/api/v1         | REST API                        |
| Health Check    | http://localhost:8080/actuator/health| Backend health status           |
| H2 Console      | http://localhost:8080/h2-console     | Database UI (local only)        |
| Swagger UI    | http://localhost:8080/swagger-ui/index.html# | Endpoints           |

---

## API Endpoints

### Tenant Registration (Sign Up)
```powershell
$body = @{
    name = "Demo Tenant"
    subdomain = "demo"
    adminEmail = "admin@demo.com"
    adminPassword = "securePassword123"
    adminFirstName = "John"
    adminLastName = "Doe"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/tenants/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### Login
```powershell
$body = @{
    email = "admin@demo.com"
    password = "securePassword123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ "X-Tenant-ID" = "demo" } `
    -Body $body

Write-Host "Token: $($response.token)"
```

### Using the Token
```powershell
$token = "your-jwt-token-here"

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/some-protected-endpoint" `
    -Method Get `
    -Headers @{ 
        "Authorization" = "Bearer $token"
        "X-Tenant-ID" = "demo" 
    }
```

---

## Environment Profiles

| Profile | Database   | Usage                              |
|---------|------------|------------------------------------|
| local   | H2 Memory  | Local development (default)        |
| dev     | PostgreSQL | Development server                 |
| uat     | PostgreSQL | User acceptance testing            |
| prod    | PostgreSQL | Production                         |

### Running with a Different Profile

```powershell
# Using environment variable
$env:SPRING_PROFILES_ACTIVE = "dev"
gradlew bootRun

# Or using command line argument
./gradlew bootRun --args='--spring.profiles.active=local'
```

---

## Project Structure

```
audio-library-project/
├── backend/                    # Spring Boot application
│   ├── src/main/java/         # Java source code
│   ├── src/main/resources/    # Config files (application*.yml)
│   ├── build.gradle.kts       # Gradle build file
│   └── gradlew.bat            # Gradle wrapper (Windows)
├── frontend/                   # React application
│   ├── src/                   # React source code
│   ├── package.json           # NPM dependencies
│   └── vite.config.ts         # Vite configuration
├── infrastructure/             # Terraform IaC
│   ├── providers.tf
│   └── variables.tf
├── ARCHITECTURE.md             # System design documentation
└── README.md                   # This file
```

---

## Debugging in VS Code / Cursor

The project includes pre-configured debug configurations in `.vscode/launch.json`.

### Available Debug Configurations

| Configuration | Description |
|---------------|-------------|
| **Backend - Spring Boot** | Launches the Spring Boot app with debugger attached |
| **Backend - Debug (Attach)** | Attaches to a running backend on port 5005 |
| **Frontend - Chrome** | Launches Chrome and debugs the frontend |
| **Frontend - Vite Dev Server** | Runs the Vite dev server with debugging |
| **Full Stack** | Runs both backend and frontend together |

### How to Debug the Backend

1. Open the **Run and Debug** panel (`Ctrl+Shift+D`)
2. Select **"Backend - Spring Boot"** from the dropdown
3. Press **F5** to start debugging
4. Set breakpoints in your Java code by clicking in the gutter (left of line numbers)
5. The debugger will pause at breakpoints and let you inspect variables

### How to Debug the Frontend

1. Start the backend first (using the steps above or terminal)
2. Select **"Frontend - Vite Dev Server"** from the debug dropdown
3. Press **F5**
4. Set breakpoints in your TypeScript/React code

### Debug Both Together

1. Select **"Full Stack (Backend + Frontend)"** from the dropdown
2. Press **F5** - both services will start with debugging enabled

### Available Build Tasks

Run tasks via `Ctrl+Shift+P` → "Tasks: Run Task":

- `gradle: bootRun` - Run the backend
- `gradle: build` - Build the backend
- `gradle: clean` - Clean build artifacts
- `npm: dev - frontend` - Run frontend dev server
- `npm: build - frontend` - Build frontend for production

---

## Troubleshooting

### SSL/Certificate Errors (Corporate Proxy)
If you see SSL handshake errors, the `gradle.properties` file contains workarounds. You can also set:
```powershell
$env:GRADLE_OPTS = "-Djavax.net.ssl.trustStore=NUL -Djavax.net.ssl.trustStoreType=Windows-ROOT"
```

### JAVA_HOME Not Set
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"  # Adjust path as needed
```

### Port Already in Use
Kill the process using port 8080:
```powershell
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

---

## Multi-Tenancy

The platform uses **schema-per-tenant** isolation:
- Each tenant gets their own database schema
- Tenant is resolved via subdomain (e.g., `demo.audiolib.com`) or `X-Tenant-ID` header
- Data is completely isolated between tenants

---

## License

Proprietary - All rights reserved.


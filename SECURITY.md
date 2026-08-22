# 🛡️ Pinslim Security & Server Hardening Guide

This document outlines the security architecture, best practices, and hardening recommendations for deploying **Pinslim** in self-hosted Docker environments.

---

## ❓ FAQ: Do these security measures alter the Pinslim user experience?

**No, absolutely not!** 
All security configurations operate strictly **under the hood at the server and container level** (process isolation, privilege dropping, memory & CPU constraints). 

For users interacting with Pinslim through the browser (drawing schematics, writing code, simulating microcontrollers, flashing hardware, exporting BOM and diagrams), the user experience remains **100% identical, fast, and responsive**.

---

## 🔒 10 Core Security Recommendations

### 1. Execution as Non-Root User (`USER pinslim`)
- **Objective**: Prevent container root escapes to the host operating system.
- **Implementation**: The container runs under a dedicated unprivileged user (`pinslim`, UID 1000). Even if remote code execution (RCE) occurs inside the container, the attacker gains no `root` privileges on the host system.

### 2. Capabilities Dropping (`--cap-drop=ALL`)
- **Objective**: Minimize attack surface against host kernel vulnerabilities.
- **Implementation**: All default Linux capabilities are dropped in `docker-compose.yml`, explicitly whitelisting only the minimal required set:
```yaml
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - SETUID
  - SETGID
  - DAC_OVERRIDE
```

### 3. Isolation from Docker Socket (`/var/run/docker.sock`)
- **Objective**: Prevent host system compromise.
- **Implementation**: The host Docker socket is **never** mounted inside the container. Pinslim compiles and emulates code inside isolated sub-processes and does not require access to the Docker engine daemon.

### 4. CPU, Memory & Process Limits (Anti-DoS & Fork-Bomb Protection)
- **Objective**: Prevent malicious or malformed code from overloading the host server or crashing adjacent containers.
- **Implementation**: Strict caps on PID creation (max. 200–250 processes), total RAM, and CPU core utilization:
```yaml
pids_limit: 250
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 4096M
```

### 5. Compilation Sub-process Sandboxing & Timeouts (`arduino-cli` & ESP-IDF)
- **Objective**: Prevent infinite compilation loops or stuck background workers.
- **Implementation**: The FastAPI backend enforces rigid execution timeouts for all `arduino-cli` and `ninja`/ESP-IDF invocations (max 60–120 seconds). Non-responsive worker processes are automatically killed.

### 6. No New Privileges Escapes (`no-new-privileges:true`)
- **Objective**: Prevent privilege escalation via `setuid`/`setgid` binaries inside the container.
- **Implementation**:
```yaml
security_opt:
  - no-new-privileges:true
```

### 7. CORS & Host Header Hardening
- **Objective**: Mitigate Cross-Site Request Forgery (CSRF) and unauthorized cross-origin API calls.
- **Implementation**: In production environments, the FastAPI backend restricts API origins via `ALLOWED_ORIGINS` to trusted domains.

### 8. Web Security Headers via Nginx Reverse Proxy
- **Objective**: Protect client web browsers from Clickjacking, XSS, and MIME-type sniffing.
- **Implementation**: Nginx enforces security headers across all responses:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 9. Recommended: Host User Namespaces Remapping (`userns-remap`)
- **Objective**: Map container `root` to an unprivileged host UID.
- **Recommendation**: Enable `userns-remap` in the host server's `/etc/docker/daemon.json`:
```json
{
  "userns-remap": "default"
}
```

### 10. Automated Vulnerability Scanning (Trivy / Grype)
- **Objective**: Detect known vulnerabilities (CVEs) in base images and packages.
- **Recommendation**: Run container vulnerability scans prior to production deployments:
```bash
trivy image pinslim-app:latest
```

---

## 🚀 Recommended Production `docker-compose.yml`

```yaml
services:
  pinslim:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    container_name: pinslim-app
    restart: unless-stopped
    ports:
      - "127.0.0.1:3082:80"  # Bind locally behind reverse proxy (Nginx / Traefik)
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - DAC_OVERRIDE
    pids_limit: 250
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4096M
    environment:
      - DATABASE_URL=sqlite+aiosqlite:////app/data/pinslim.db
      - DATA_DIR=/app/data
      - IDF_PATH=/opt/esp-idf
      - IDF_TOOLS_PATH=/root/.espressif
      - ARDUINO_ESP32_PATH=/opt/arduino-esp32
      - IDF_CCACHE_ENABLE=1
      - CCACHE_DIR=/var/cache/ccache
    volumes:
      - ./data:/app/data
      - arduino-libs:/root/.arduino15
      - ccache:/var/cache/ccache
      - velxio-build:/var/lib/velxio-build

volumes:
  arduino-libs:
  ccache:
  velxio-build:
```

---
*Documentation for Pinslim Server Deployments.*

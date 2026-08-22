# 🛡️ Pinslim Security & Hardening Guide

Dieses Dokument beschreibt die Sicherheitsarchitektur, Best Practices und Maßnahmen zur Absicherung von **Pinslim** bei der Bereitstellung auf eigenen Servern oder in Docker-Umgebungen.

---

## ❓ Antwort: Ändern diese Sicherheitsmaßnahmen die Bedienung von Pinslim?

**Nein, absolut nicht!** 
Sämtliche Sicherheitskonfigurationen wirken ausschließlich **unter der Haube auf Server- und Container-Ebene** (Prozessisolierung, Systemrechte, Speicher- & CPU-Limits). 

Für den Benutzer im Browser bleibt die Bedienung (Schaltpläne zeichnen, Code schreiben, Mikrocontroller simulieren, flashen, Stücklisten und Diagramme exportieren) **zu 100 % identisch, schnell und intuitiv**.

---

## 🔒 Die 10 zentralen Sicherheitsmaßnahmen

### 1. Ausführung als unprivilegierter Benutzer (`USER pinslim`)
- **Ziel**: Schutz vor Root-Escapes auf das Host-Betriebssystem.
- **Konstruktion**: Im Docker-Container laufen Prozesse als dedizierter System-User (`pinslim`, UID 1000). Selbst wenn ein Angreifer RCE (Remote Code Execution) im Container erzielt, besitzt er keine `root`-Rechte auf dem Host.

### 2. Striktes Droppen von Linux-Capabilities (`--cap-drop=ALL`)
- **Ziel**: Reduzierung der Angriffsfläche für Kernel-Exploits.
- **Konstruktion**: In `docker-compose.yml` werden alle erweiterten Linux-Capabilities gedroppt. Es werden nur die minimal erforderlichen Rechte zugewiesen.
```yaml
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - SETUID
  - SETGID
  - DAC_OVERRIDE
```

### 3. Keine Einbindung des Docker-Sockets (`/var/run/docker.sock`)
- **Ziel**: Schutz vor kompletter Übernahme des Host-Systems.
- **Konstruktion**: Der Host-Docker-Socket darf **niemals** in den Container gemountet werden. Pinslim kompiliert und emuliert innerhalb eigener isolierter Subprozesse und benötigt keinen Zugriff auf die Docker-Engine.

### 4. CPU-, Arbeitsspeicher- und Prozess-Limits (Anti-DoS & Fork-Bomb Protection)
- **Ziel**: Verhindern, dass bösartiger/fehlerhafter Code den Server oder benachbarte Container lahmlegt.
- **Konstruktion**: Begrenzung von PIDs (max. 200 Prozesse), Arbeitsspeicher und CPU-Zyklen.
```yaml
pids_limit: 200
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 4096M
```

### 5. Sandboxing & Timeout-Garantien für Compilations (`arduino-cli` & ESP-IDF)
- **Ziel**: Verhindern von endlos laufenden Subprozessen oder Hängern beim Kompilieren.
- **Konstruktion**: Das FastAPI-Backend erzwingt strikte Timeouts für jeden `arduino-cli`- und `ninja`/ESP-IDF-Aufruf (max. 60–120 Sekunden). Nicht reagierende Prozesse werden automatisch beendet.

### 6. Isolierung von Systemrechten (`no-new-privileges:true`)
- **Ziel**: Verhindern von Rechteausweitung über `setuid`/`setgid`-Binaries.
- **Konstruktion**:
```yaml
security_opt:
  - no-new-privileges:true
```

### 7. CORS & Host Header Hardening im FastAPI Backend
- **Ziel**: Schutz vor Cross-Site Request Forgery (CSRF) und Malicious Origin Calls.
- **Konstruktion**: Die API erlaubt in der Produktion nur Anfragen der eigenen Host-Domain (`ALLOWED_ORIGINS`).

### 8. Web-Sicherheitsheader via Nginx Proxy
- **Ziel**: Schutz der Nutzer vor Clickjacking, XSS und Content Sniffing.
- **Konstruktion**: Nginx setzt für alle HTTP-Antworten folgende Sicherheits-Header:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 9. Empfohlen: Isolation via User Namespaces (`userns-remap`)
- **Ziel**: Container-`root` entspricht einem unprivilegierten Benutzer auf dem Host.
- **Empfehlung**: Aktivieren Sie `userns-remap` in der `/etc/docker/daemon.json` Ihres Servers:
```json
{
  "userns-remap": "default"
}
```

### 10. Automatische Sicherheits-Scans (Trivy / Grype)
- **Ziel**: Erkennung bekannter Sicherheitslücken in System-Abhängigkeiten.
- **Empfehlung**: Scannen Sie gebaute Docker-Images vor dem Deployment:
```bash
trivy image pinslim-app:latest
```

---

## 🚀 Empfohlene `docker-compose.yml` für die Produktion

```yaml
services:
  pinslim:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    container_name: pinslim-app
    restart: unless-stopped
    ports:
      - "127.0.0.1:3082:80"  # Nur lokal binden, dahinter Nginx/Traefik Reverse Proxy
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - DAC_OVERRIDE
    pids_limit: 200
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
*Dokumentation erstellt für Pinslim Server Deployments.*

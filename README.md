# Pinslim: Browser-Based Embedded Simulator & Hardware Flasher

**Pinslim** is an open-source multi-board emulator, circuit simulator, and browser hardware flasher for ESP32, Arduino, and embedded systems.

Write Arduino C++, MicroPython, or Python code, compile it, simulate real CPU execution with 150+ interactive electronic components, and flash your compiled code directly to connected hardware via Web Serial — all inside your browser.

![Pinslim Editor Preview](docs/assets/pinslim-hero-preview.png)
*Figure 1: Interactive Pinslim Editor workspace featuring Arduino Uno, code editor, and real-time circuit simulation.*

![Pinslim Component Picker Preview](docs/assets/pinslim-components-preview.png)
*Figure 2: Component Picker showing available boards and `VELXIO.DEV EXKLUSIV` badges for pro/online-only hardware.*

---

## 🚀 Features

- **Direct Editor Launch**: Opens directly into the interactive workspace.
- **Light & Dark Themes**: Toggle seamlessly between Dark and Light mode via the View menu.
- **Web Serial Hardware Flashing**: Flash compiled sketches directly to connected ESP32 or Arduino microcontrollers via Web Serial without desktop software.
- **Multi-Board Simulation**: Emulates AVR8 (Arduino Uno / Nano / Mega / ATtiny85), RP2040 (Raspberry Pi Pico), and ESP32 (QEMU backend).
- **Embedded Examples Modal**: Instantly search and load ready-to-run example projects from within the editor.
- **BOM & Schematic Export**: Generate accurate Bill of Materials (CSV) and high-fidelity PNG schematic diagrams.
- **Open-Source Docker Deployment**: Hardened standalone Docker setup requiring no proprietary license keys.

---

## 🐳 Quick Start (Docker & Portainer)

### Local Docker Compose

To run Pinslim locally or on your server with Docker:

```bash
docker compose up -d --build
```

Then open **<http://localhost:3082>** in your browser.

### Native install (without Docker)

On Debian/Ubuntu, `scripts/setup-native.sh` installs the toolchains the Docker
image bundles — arduino-cli with the AVR, RP2040 and ATtiny cores, ESP-IDF 4.4.7
with arduino-esp32 2.0.17, and QEMU for ESP32 / ESP32-C3 emulation (built from
lcgamboa's public `picsimlab-esp32` branch; ESP32-S3 and ESP32-CAM need Velxio's
own QEMU tree, see [docs/BUILD-QEMU.md](docs/BUILD-QEMU.md)):

```bash
scripts/setup-native.sh          # or: arduino | espidf | qemu
```

Point the backend at the result with `IDF_PATH=/opt/pinslim/esp-idf`,
`IDF_TOOLS_PATH=/opt/pinslim/espressif`, `ARDUINO_ESP32_PATH=/opt/pinslim/arduino-esp32`,
`QEMU_ESP32_LIB=/opt/pinslim/qemu/libqemu-xtensa.so` and
`QEMU_RISCV32_LIB=/opt/pinslim/qemu/libqemu-riscv32.so`, with `~/.local/bin`
(arduino-cli) on `PATH`. The first ESP32 compile builds all of ESP-IDF and can
take longer than one 10-minute compile window on small machines — compile again
and it resumes where it stopped.

### Portainer & Traefik Deployment

When deploying Pinslim as a Stack in **Portainer** directly from the Git repository:

* **Repository Branch**: Use `master` (e.g., `https://github.com/TJRSchmidbauer/pinslim.git#master`).
* **Dockerfile Name**: Specify `Dockerfile.standalone` under `build.dockerfile`.
* **Internal Port**: Set Traefik server loadbalancer port to `80` (internal Nginx port).

A ready-to-use Stack template is available in [`docker/portainer-stack.yml`](docker/portainer-stack.yml).

---

## 🔒 Security & Server Hardening

For details on deploying Pinslim securely on your own server (process isolation, capability dropping, CPU/RAM limits, sub-process sandboxing), see the [SECURITY.md](SECURITY.md) guide.

---

## 📜 Legal, AI Development & Trademark Disclaimers / Rechtliche Hinweise

### 1. Origin Notice & Gratitude
Pinslim is an independent open-source fork based on **Velxio**, created by **David Montero Crespo**.
- Original Repository: [github.com/davidmonterocrespo24/velxio](https://github.com/davidmonterocrespo24/velxio)
- Official Platform: [velxio.dev](https://velxio.dev)

Special thanks to **David Montero Crespo** for architecting the original simulator engine.

### 2. Antigravity AI Notice
Sämtliche Anpassungen, Refactorings, UI/UX-Optimierungen, Stücklisten- & PNG-Export-Erweiterungen, Web-Serial-Flasher-Integration sowie Sicherheitshärtungen an dieser Codebasis wurden in kooperativer Entwicklung unter Einsatz des KI-Assistenten **Antigravity** (Google DeepMind) umgesetzt.

### 3. Trademark Disclaimer
All product names, trademarks, logos, and brands mentioned in this project (such as *Arduino, ESP32, Espressif, Raspberry Pi, MicroPython, SAMD, RP2040, etc.*) are the property of their respective trademark owners. Pinslim is an independent open-source community project and is **not affiliated with, sponsored by, or endorsed by** any of these trademark holders.

### 4. Commercial Licensing & Partner Disclaimer 
- Commercial licenses or Pro subscriptions are sold exclusively by David Montero Crespo via [velxio.dev](https://velxio.dev). Pinslim does not sell commercial licenses or process payments.
- Any partners, sponsors, or commercial hardware suppliers referenced in connection with the original Velxio project belong solely to Velxio and David Montero Crespo. They are **not partners or sponsors of Pinslim**.

### 5. License & Warranty Disclaimer (Lizenz & Haftungsausschluss)
Pinslim is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. The software is provided "AS IS", without warranty of any kind, express or implied.

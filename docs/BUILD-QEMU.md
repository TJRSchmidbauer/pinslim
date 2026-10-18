# Building QEMU from source for Pinslim

The Pinslim docker image ships with support for `libqemu-xtensa` and `libqemu-riscv32` libraries so ESP32 / ESP32-S3 / ESP32-C3 simulation works out of the box.

Pinslim is open-source. You can build these binaries fully automated using the provided script or manually from source.

## Automated Build Script (Recommended)

Run the included automated helper script to clone, compile QEMU libraries, and fetch open-source ESP32 ROMs into `prebuilt/qemu/`:

```bash
chmod +x scripts/build-qemu.sh
./scripts/build-qemu.sh
```

Once completed, build your Pinslim Docker image:

```bash
docker build -f Dockerfile.standalone -t pinslim:latest .
```

---

## Manual Step-by-Step Guide

### What you'll produce

| File | Architecture | Used for |
|---|---|---|
| `libqemu-xtensa.so` | Xtensa LX6 / LX7 | ESP32, ESP32-S3, ESP32-CAM, Arduino Nano ESP32 |
| `libqemu-riscv32.so` | RISC-V RV32IMC | ESP32-C3, XIAO ESP32-C3, CH32V003 |

The Pinslim backend dlopen's these at runtime through the dynamic linker (`backend/app/services/qemu_runtime.py`). Drop the freshly built files into `prebuilt/qemu/` before running Docker build.

### 1. Clone the fork

```bash
git clone https://github.com/lcgamboa/qemu.git
cd qemu
git checkout 822927b6
```

### 2. Install build dependencies

**Debian / Ubuntu**:
```bash
sudo apt-get update
sudo apt-get install -y \
    git ninja-build pkg-config \
    libglib2.0-dev libpixman-1-dev \
    python3 python3-venv python3-pip \
    flex bison
```

### 3. Configure and build — Xtensa (ESP32 / ESP32-S3)

```bash
mkdir build-xtensa && cd build-xtensa
../configure \
    --target-list=xtensa-softmmu \
    --disable-werror \
    --enable-shared-lib \
    --disable-tools \
    --disable-docs
ninja
cp libqemu-xtensa.so ../../prebuilt/qemu/
cd ..
```

### 4. Configure and build — RISC-V (ESP32-C3)

```bash
mkdir build-riscv32 && cd build-riscv32
../configure \
    --target-list=riscv32-softmmu \
    --disable-werror \
    --enable-shared-lib \
    --disable-tools \
    --disable-docs
ninja
cp libqemu-riscv32.so ../../prebuilt/qemu/
cd ..
```

### 5. Download ROM blobs

Fetch Espressif ROM files into `prebuilt/qemu/`:
- `esp32-v3-rom.bin`
- `esp32-v3-rom-app.bin`
- `esp32c3-rom.bin`
- `esp32s3_rev0_rom.bin`

Now you can build Pinslim Docker without any external license keys:

```bash
docker build -f Dockerfile.standalone -t pinslim:latest .
```

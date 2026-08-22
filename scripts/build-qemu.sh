#!/usr/bin/env bash
# Automates compiling QEMU shared libraries & downloading ROMs for Pinslim OSS Docker build

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PREBUILT_DIR="${ROOT_DIR}/prebuilt/qemu"

echo "=== Pinslim Open-Source QEMU Builder ==="
mkdir -p "${PREBUILT_DIR}"
BUILD_TMP="$(mktemp -d -t pinslim-qemu-build-XXXXXX)"

trap 'rm -rf "${BUILD_TMP}"' EXIT

echo "--> Cloning lcgamboa/qemu repository..."
git clone --depth 1 https://github.com/lcgamboa/qemu.git "${BUILD_TMP}/qemu"

cd "${BUILD_TMP}/qemu"

echo "--> Building Xtensa target (ESP32/ESP32-S3)..."
mkdir -p build-xtensa && cd build-xtensa
../configure \
    --target-list=xtensa-softmmu \
    --disable-werror \
    --enable-shared-lib \
    --disable-tools \
    --disable-docs
ninja
cp libqemu-xtensa.so "${PREBUILT_DIR}/"

echo "--> Building RISC-V target (ESP32-C3)..."
cd "${BUILD_TMP}/qemu"
mkdir -p build-riscv && cd build-riscv
../configure \
    --target-list=riscv32-softmmu \
    --disable-werror \
    --enable-shared-lib \
    --disable-tools \
    --disable-docs
ninja
cp libqemu-riscv32.so "${PREBUILT_DIR}/"

echo "--> Downloading Espressif open-source ROM binaries..."
cd "${PREBUILT_DIR}"
ROMS=(
  "https://raw.githubusercontent.com/espressif/openocd-esp32/master/bin/esp32-v3-rom.bin"
  "https://raw.githubusercontent.com/espressif/openocd-esp32/master/bin/esp32-v3-rom-app.bin"
  "https://raw.githubusercontent.com/espressif/openocd-esp32/master/bin/esp32c3-rom.bin"
  "https://raw.githubusercontent.com/espressif/openocd-esp32/master/bin/esp32s3_rev0_rom.bin"
)

for rom_url in "${ROMS[@]}"; do
  filename="$(basename "${rom_url}")"
  if [ ! -f "${filename}" ]; then
    echo "Downloading ${filename}..."
    curl -fSL -o "${filename}" "${rom_url}" || echo "Warning: ${filename} download failed"
  fi
done

echo "=== Success! QEMU binaries and ROMs saved to prebuilt/qemu/ ==="
ls -lh "${PREBUILT_DIR}"

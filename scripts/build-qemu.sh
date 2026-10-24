#!/usr/bin/env bash
# Builds the QEMU shared libraries Pinslim uses for ESP32 / ESP32-C3
# emulation (libqemu-xtensa.so, libqemu-riscv32.so) from the public
# lcgamboa/qemu `picsimlab-esp32` branch, and copies them together with the
# ESP32 boot ROMs into prebuilt/qemu/.
#
# What this covers: the `esp32-picsimlab` and `esp32c3-picsimlab` machines
# (ESP32 DevKit, ESP32-C3 and their variants). ESP32-S3 and the ESP32-CAM
# camera path need device models that only exist in Velxio's own QEMU tree
# (see docs/BUILD-QEMU.md); those boards will not boot with these libraries.
#
# The branch's own build_libqemu-esp32.sh does the work: it configures both
# targets, builds them, then relinks the system emulator as a shared library.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PREBUILT_DIR="${ROOT_DIR}/prebuilt/qemu"
QEMU_BRANCH="${QEMU_BRANCH:-picsimlab-esp32}"

echo "=== Pinslim QEMU builder (lcgamboa/qemu ${QEMU_BRANCH}) ==="
mkdir -p "${PREBUILT_DIR}"
BUILD_TMP="$(mktemp -d -t pinslim-qemu-build-XXXXXX)"
trap 'rm -rf "${BUILD_TMP}"' EXIT

git clone --depth 1 -b "${QEMU_BRANCH}" https://github.com/lcgamboa/qemu.git "${BUILD_TMP}/qemu"
cd "${BUILD_TMP}/qemu"
bash build_libqemu-esp32.sh

cp build/libqemu-xtensa.so build/libqemu-riscv32.so "${PREBUILT_DIR}/"
# Debug info roughly halves the size; the emulator does not need it.
strip --strip-debug "${PREBUILT_DIR}/libqemu-xtensa.so" "${PREBUILT_DIR}/libqemu-riscv32.so" || true

# Boot ROMs ship with the branch; they must sit next to the .so files.
for rom in esp32-v3-rom.bin esp32-v3-rom-app.bin esp32c3-rom.bin esp32s3_rev0_rom.bin; do
  cp "pc-bios/${rom}" "${PREBUILT_DIR}/"
done

echo "=== Done: QEMU libraries and ROMs in prebuilt/qemu/ ==="
ls -lh "${PREBUILT_DIR}"

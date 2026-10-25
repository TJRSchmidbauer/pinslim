#!/usr/bin/env bash
# Builds Pinslim's own QEMU libraries for ESP32-family emulation:
#
#   libqemu-xtensa.so   machines esp32-picsimlab, esp32s3-picsimlab
#   libqemu-riscv32.so  machines esp32c3-picsimlab, esp32c6-picsimlab
#
# plus the boot ROMs, into prebuilt/qemu/ (or $1).
#
# Sources (pinned, all GPL-2.0):
#   - lcgamboa/qemu `picsimlab-esp32`: QEMU 9.2 with the PICSimLab host
#     interface (GPIO/ADC/LEDC/I2C/SPI/UART callbacks) for ESP32 and ESP32-C3
#   - espressif/qemu `esp-develop`: the ESP32-C6 SoC models
#   - qemu/pinslim.patch (this repo): the shared picsimlab API, the
#     esp32c6-picsimlab and esp32s3-picsimlab machines, an S3 GPIO model with
#     the real register layout (49 pins, two banks), the S3 SENS ADC, WiFi on
#     the C3 and S3, and 8-channel LEDC on the S3 (see docs/BUILD-QEMU.md).
#
# The ESP32-P4 has no QEMU model anywhere; it can be compiled and flashed to
# real hardware, but not emulated.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${1:-${ROOT_DIR}/prebuilt/qemu}"
PATCH="${ROOT_DIR}/qemu/pinslim.patch"
C6_FILES="${ROOT_DIR}/qemu/esp32c6-files.txt"

LCGAMBOA_URL=https://github.com/lcgamboa/qemu.git
LCGAMBOA_COMMIT=9c2989840853e3b47cd1d9cbd38ce8ba41af260a   # picsimlab-esp32
ESPRESSIF_URL=https://github.com/espressif/qemu.git
ESPRESSIF_COMMIT=febae182e132e4055529be423a818225ebddaa3a  # esp-develop

WORK="${QEMU_WORK_DIR:-$(mktemp -d -t pinslim-qemu-XXXXXX)}"
if [ -z "${QEMU_WORK_DIR:-}" ]; then
  trap 'rm -rf "${WORK}"' EXIT
fi

fetch() {  # fetch <url> <commit> <dir>
  mkdir -p "$3"
  git -C "$3" init -q
  git -C "$3" fetch -q --depth 1 "$1" "$2"
  git -C "$3" checkout -q FETCH_HEAD
}

echo "=== Pinslim QEMU: sources ==="
fetch "${LCGAMBOA_URL}" "${LCGAMBOA_COMMIT}" "${WORK}/qemu"
fetch "${ESPRESSIF_URL}" "${ESPRESSIF_COMMIT}" "${WORK}/esp-qemu"
# The lcgamboa tree uses git submodules for some subprojects (keycodemapdb …)
git -C "${WORK}/qemu" submodule update --init --depth 1 --recursive -q || true

echo "=== Pinslim QEMU: ESP32-C6 models from espressif/qemu ==="
while read -r f; do
  [ -z "${f}" ] && continue
  mkdir -p "$(dirname "${WORK}/qemu/${f}")"
  cp "${WORK}/esp-qemu/${f}" "${WORK}/qemu/${f}"
done < "${C6_FILES}"

echo "=== Pinslim QEMU: apply qemu/pinslim.patch ==="
git -C "${WORK}/qemu" apply --whitespace=nowarn "${PATCH}"

echo "=== Pinslim QEMU: build (xtensa + riscv32, shared libraries) ==="
cd "${WORK}/qemu"
# Same configuration as lcgamboa's build_libqemu-esp32.sh (every optional
# feature off, which includes PIE — the objects end up in a shared library)
# but WITHOUT --enable-debug: that builds at -O0 and slows the emulated
# boards down noticeably.
flags="$(./configure --help | perl -ne 'print if s/^  ([a-z][\w-]*) .*/\1/' | tail -n +2 | awk '{print "--disable-"$1}' ORS=' ')"
mkdir -p build
(cd build && ../configure --target-list=xtensa-softmmu,riscv32-softmmu \
    --extra-cflags=-fPIC ${flags} --enable-tcg --enable-system --enable-gcrypt --enable-slirp)
ninja -C build -j"$(nproc)"

# Relink each system emulator as a shared library: the exact link command,
# minus system/main.c.o and -pie, plus -shared.
for arch in xtensa riscv32; do
  rm -f "build/qemu-system-${arch}"
  cmd=$(ninja -C build -v "qemu-system-${arch}" | grep -E -- "-o qemu-system-${arch}( |$)" | tail -1 | sed 's/^\[[0-9]*\/[0-9]*\] //')
  cmd=$(echo "${cmd}" | sed "s#qemu-system-${arch}.p/system_main.c.o##g; s# -pie# #g; s#-o qemu-system-${arch}#-shared -o libqemu-${arch}.so#")
  (cd build && eval "${cmd}")
done

mkdir -p "${OUT_DIR}"
cp build/libqemu-xtensa.so build/libqemu-riscv32.so "${OUT_DIR}/"
# Debug info roughly halves the size; the emulator does not need it.
strip --strip-debug "${OUT_DIR}/libqemu-xtensa.so" "${OUT_DIR}/libqemu-riscv32.so" || true

# Boot ROMs must sit next to the .so files (the worker passes -L <lib dir>).
for rom in esp32-v3-rom.bin esp32-v3-rom-app.bin esp32c3-rom.bin esp32s3_rev0_rom.bin; do
  cp "pc-bios/${rom}" "${OUT_DIR}/"
done
cp "${WORK}/esp-qemu/pc-bios/esp32c6-rom.bin" "${OUT_DIR}/"

echo "=== Done: ${OUT_DIR} ==="
ls -lh "${OUT_DIR}"

#!/usr/bin/env bash
# Native (non-Docker) toolchain setup for Pinslim on Debian/Ubuntu.
#
# Mirrors what Dockerfile.standalone + docker/entrypoint.sh do inside the
# container, but installs onto the host so a bare-metal / VM install can
# compile and emulate the same boards:
#
#   1. arduino-cli + the AVR, RP2040, ATTinyCore and STM32 cores
#   2. ESP-IDF 5.5 + arduino-esp32 3.3: the toolchain for ESP32, S3, C3,
#      C6 and P4 (arduino-esp32 is built as an ESP-IDF component, so the
#      core pins the IDF version — bump both together)
#   3. Pinslim's QEMU libraries + ROMs (scripts/build-qemu.sh): emulation of
#      ESP32, ESP32-S3, ESP32-C3 and ESP32-C6. The ESP32-P4 has no QEMU model
#      and is compile/flash only.
#
# Every step is idempotent: re-running skips what is already installed.
# Usage:  scripts/setup-native.sh [arduino|espidf|qemu|all]   (default: all)
#
# Backend environment afterwards (systemd unit / .env):
#   IDF_PATH=IDF5_PATH=$PINSLIM_OPT/esp-idf-v5
#   IDF_TOOLS_PATH=$PINSLIM_OPT/espressif
#   ARDUINO_ESP32_PATH=ARDUINO_ESP32_5_PATH=$PINSLIM_OPT/arduino-esp32-3
#   QEMU_ESP32_LIB=$PINSLIM_OPT/qemu/libqemu-xtensa.so
#   QEMU_RISCV32_LIB=$PINSLIM_OPT/qemu/libqemu-riscv32.so
#   PATH including ~/.local/bin (arduino-cli)
#
# Paths (override via env):
#   PINSLIM_OPT   /opt/pinslim      ESP-IDF, arduino-esp32, QEMU libs
#   Arduino data  ~/.arduino15      (arduino-cli default)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PINSLIM_OPT="${PINSLIM_OPT:-/opt/pinslim}"
IDF_TOOLS_PATH="${PINSLIM_OPT}/espressif"
IDF_VERSION="${IDF_VERSION:-v5.5.6}"
ARDUINO_ESP32_VERSION="${ARDUINO_ESP32_VERSION:-3.3.12}"
IDF_PATH="${PINSLIM_OPT}/esp-idf-v5"
ARDUINO_ESP32_PATH="${PINSLIM_OPT}/arduino-esp32-3"
QEMU_DIR="${PINSLIM_OPT}/qemu"
LOCAL_BIN="${HOME}/.local/bin"

step="${1:-all}"

log() { printf '\n=== %s ===\n' "$*"; }

ensure_opt() {
  if [ ! -d "${PINSLIM_OPT}" ]; then
    sudo mkdir -p "${PINSLIM_OPT}"
    sudo chown "$(id -u):$(id -g)" "${PINSLIM_OPT}"
  fi
}

setup_arduino() {
  log "arduino-cli"
  mkdir -p "${LOCAL_BIN}"
  if ! command -v arduino-cli >/dev/null && [ ! -x "${LOCAL_BIN}/arduino-cli" ]; then
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh \
      | BINDIR="${LOCAL_BIN}" sh
  fi
  local cli
  cli="$(command -v arduino-cli || echo "${LOCAL_BIN}/arduino-cli")"

  if [ ! -f "${HOME}/.arduino15/arduino-cli.yaml" ]; then
    "${cli}" config init
  fi
  for url in \
    https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json \
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json \
    http://drazzy.com/package_drazzy.com_index.json \
    https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json
  do
    "${cli}" config add board_manager.additional_urls "${url}" 2>/dev/null || true
  done

  # Vendored index seeds (issue #254): a missing index breaks every compile.
  for seed in "${ROOT_DIR}"/backend/board-indexes/package_*.json; do
    [ -f "${seed}" ] || continue
    dest="${HOME}/.arduino15/$(basename "${seed}")"
    [ -f "${dest}" ] || cp "${seed}" "${dest}"
  done

  "${cli}" core update-index || true
  "${cli}" core install arduino:avr
  "${cli}" core install rp2040:rp2040
  "${cli}" core install ATTinyCore:avr@1.4.1 || echo "WARN: ATTinyCore not installed"
  if [ "${PINSLIM_WITH_STM32:-0}" = "1" ]; then
    "${cli}" core install STMicroelectronics:stm32 || echo "WARN: STM32 core not installed"
  fi
}

setup_espidf() {
  log "ESP-IDF ${IDF_VERSION} + arduino-esp32 ${ARDUINO_ESP32_VERSION}"
  ensure_opt
  sudo apt-get install -y --no-install-recommends \
    git wget flex bison gperf python3 python3-pip python3-venv \
    cmake ninja-build ccache libffi-dev libssl-dev libusb-1.0-0 dfu-util

  if [ ! -f "${IDF_PATH}/export.sh" ]; then
    git clone -b "${IDF_VERSION}" --recursive --depth=1 --shallow-submodules \
      https://github.com/espressif/esp-idf.git "${IDF_PATH}"
  fi
  IDF_TOOLS_PATH="${IDF_TOOLS_PATH}" "${IDF_PATH}/install.sh" esp32,esp32s3,esp32c3,esp32c6,esp32p4
  # Debuggers and OpenOCD are not used by the compile pipeline (~400 MB).
  rm -rf "${IDF_TOOLS_PATH}"/tools/*-gdb "${IDF_TOOLS_PATH}/tools/openocd-esp32" "${IDF_TOOLS_PATH}/dist"

  if [ ! -d "${ARDUINO_ESP32_PATH}/cores" ]; then
    git clone --branch "${ARDUINO_ESP32_VERSION}" --depth=1 --recursive --shallow-submodules \
      https://github.com/espressif/arduino-esp32.git "${ARDUINO_ESP32_PATH}"
  fi

  # mkspiffs bakes uploaded files into the SPIFFS partition at compile time
  # (looked up under IDF_TOOLS_PATH/tools/mkspiffs/*/mkspiffs/mkspiffs).
  local mk="${IDF_TOOLS_PATH}/tools/mkspiffs/0.2.3/mkspiffs/mkspiffs"
  if [ ! -x "${mk}" ]; then
    mkdir -p "$(dirname "${mk}")"
    tmp="$(mktemp -d)"
    wget -qO "${tmp}/mkspiffs.tgz" \
      https://github.com/igrr/mkspiffs/releases/download/0.2.3/mkspiffs-0.2.3-arduino-esp32-linux64.tar.gz
    tar -xzf "${tmp}/mkspiffs.tgz" -C "${tmp}"
    cp "${tmp}/mkspiffs-0.2.3-arduino-esp32-linux64/mkspiffs" "${mk}"
    chmod +x "${mk}"
    rm -rf "${tmp}"
  fi
}

setup_qemu() {
  log "Pinslim QEMU (ESP32, S3, C3, C6 emulation)"
  ensure_opt
  if [ -s "${QEMU_DIR}/libqemu-xtensa.so" ] && [ -s "${QEMU_DIR}/libqemu-riscv32.so" ] \
     && [ -f "${QEMU_DIR}/esp32c6-rom.bin" ]; then
    echo "already built"
    return
  fi
  sudo apt-get install -y --no-install-recommends \
    build-essential git ninja-build pkg-config perl libglib2.0-dev libpixman-1-dev \
    libgcrypt20-dev libslirp-dev libfdt-dev zlib1g-dev python3 python3-venv \
    python3-setuptools meson flex bison
  "${ROOT_DIR}/scripts/build-qemu.sh" "${QEMU_DIR}"
}

case "${step}" in
  arduino) setup_arduino ;;
  espidf)  setup_espidf ;;
  qemu)    setup_qemu ;;
  all)     setup_arduino; setup_espidf; setup_qemu ;;
  *) echo "usage: $0 [arduino|espidf|qemu|all]" >&2; exit 2 ;;
esac

log "done (${step})"

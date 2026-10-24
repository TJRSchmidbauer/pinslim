#!/usr/bin/env bash
# Native (non-Docker) toolchain setup for Pinslim on Debian/Ubuntu.
#
# Mirrors what Dockerfile.standalone + docker/entrypoint.sh do inside the
# container, but installs onto the host so a bare-metal / VM install can
# compile and emulate the same boards:
#
#   1. arduino-cli + the AVR, RP2040, ATTinyCore and STM32 cores
#   2. ESP-IDF 4.4.7 + arduino-esp32 2.0.17 (ESP32 / ESP32-C3 compilation)
#   3. lcgamboa QEMU shared libraries + ROMs (ESP32 emulation)
#
# Every step is idempotent: re-running skips what is already installed.
# Usage:  scripts/setup-native.sh [arduino|espidf|qemu|all]   (default: all)
#
# QEMU covers ESP32 and ESP32-C3 (lcgamboa picsimlab-esp32); ESP32-S3/CAM
# need Velxio's private QEMU tree, see docs/BUILD-QEMU.md.
#
# Paths (override via env):
#   PINSLIM_OPT   /opt/pinslim      ESP-IDF, arduino-esp32, QEMU libs
#   Arduino data  ~/.arduino15      (arduino-cli default)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PINSLIM_OPT="${PINSLIM_OPT:-/opt/pinslim}"
IDF_PATH="${PINSLIM_OPT}/esp-idf"
IDF_TOOLS_PATH="${PINSLIM_OPT}/espressif"
ARDUINO_ESP32_PATH="${PINSLIM_OPT}/arduino-esp32"
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
  log "ESP-IDF 4.4.7 + arduino-esp32 2.0.17"
  ensure_opt
  sudo apt-get install -y --no-install-recommends \
    git wget flex bison gperf python3 python3-pip python3-venv \
    cmake ninja-build ccache libffi-dev libssl-dev libusb-1.0-0 python3-virtualenv

  if [ ! -f "${IDF_PATH}/export.sh" ]; then
    git clone -b v4.4.7 --recursive --depth=1 --shallow-submodules \
      https://github.com/espressif/esp-idf.git "${IDF_PATH}"
  fi
  # ESP-IDF 4.4 pins Python packages that predate Python 3.12; its installer
  # builds its own venv under IDF_TOOLS_PATH.
  IDF_TOOLS_PATH="${IDF_TOOLS_PATH}" "${IDF_PATH}/install.sh" esp32,esp32c3

  if [ ! -d "${ARDUINO_ESP32_PATH}/cores" ]; then
    git clone --branch 2.0.17 --depth=1 --recursive --shallow-submodules \
      https://github.com/espressif/arduino-esp32.git "${ARDUINO_ESP32_PATH}"
  fi

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

  # Same ldgen memoisation the Docker image applies (41% of a cold build).
  local ldgen="${IDF_PATH}/tools/ldgen/ldgen.py"
  if [ ! -f "${IDF_PATH}/tools/ldgen/ldgen_upstream.py" ]; then
    mv "${ldgen}" "${IDF_PATH}/tools/ldgen/ldgen_upstream.py"
    cp "${ROOT_DIR}/backend/scripts/ldgen_cache.py" "${ldgen}"
    chmod +x "${ldgen}"
  fi
}

setup_qemu() {
  log "QEMU (lcgamboa) for ESP32 emulation"
  ensure_opt
  if [ -s "${QEMU_DIR}/libqemu-xtensa.so" ] && [ -s "${QEMU_DIR}/libqemu-riscv32.so" ]; then
    echo "already built"
    return
  fi
  sudo apt-get install -y --no-install-recommends \
    build-essential git ninja-build pkg-config perl libglib2.0-dev libpixman-1-dev \
    libgcrypt20-dev libslirp-dev libfdt-dev zlib1g-dev python3 python3-venv \
    python3-setuptools meson flex bison
  "${ROOT_DIR}/scripts/build-qemu.sh"
  mkdir -p "${QEMU_DIR}"
  cp "${ROOT_DIR}"/prebuilt/qemu/* "${QEMU_DIR}/"
}

case "${step}" in
  arduino) setup_arduino ;;
  espidf)  setup_espidf ;;
  qemu)    setup_qemu ;;
  all)     setup_arduino; setup_espidf; setup_qemu ;;
  *) echo "usage: $0 [arduino|espidf|qemu|all]" >&2; exit 2 ;;
esac

log "done (${step})"

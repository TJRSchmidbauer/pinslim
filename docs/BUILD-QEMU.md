# Building Pinslim's QEMU

Pinslim emulates the ESP32 family with two QEMU shared libraries that the
backend loads through `ctypes` (`backend/app/services/esp32_worker.py`):

| File | Machines | Boards |
|---|---|---|
| `libqemu-xtensa.so` | `esp32-picsimlab`, `esp32s3-picsimlab` | ESP32, ESP32-CAM, Lolin32, ESP32-S3, XIAO S3, Nano ESP32 |
| `libqemu-riscv32.so` | `esp32c3-picsimlab`, `esp32c6-picsimlab` | ESP32-C3, XIAO C3, C3 SuperMini, ESP32-C6, XIAO C6 |

plus the boot ROMs next to them (the worker passes `-L <lib dir>`):
`esp32-v3-rom.bin`, `esp32-v3-rom-app.bin`, `esp32s3_rev0_rom.bin`,
`esp32c3-rom.bin`, `esp32c6-rom.bin`.

The ESP32-P4 has no QEMU model (neither upstream nor at Espressif). P4
sketches compile with ESP-IDF 5.5 and flash to real hardware; the simulator
does not run them.

## Build

```bash
scripts/build-qemu.sh                 # → prebuilt/qemu/
scripts/build-qemu.sh /opt/pinslim/qemu
```

`scripts/setup-native.sh qemu` calls the same script and installs the
dependencies first. The build needs about 6 GB of disk and, on a small
machine, one to two hours. Set `QEMU_WORK_DIR=<dir>` to keep the source tree
(and resume an interrupted build); otherwise a temporary directory is used.

## Sources (all GPL-2.0, pinned)

1. **lcgamboa/qemu `picsimlab-esp32`** @ `9c29898` — QEMU 9.2 with the
   PICSimLab host interface (GPIO, ADC, LEDC, I²C, SPI, UART callbacks) for
   the ESP32 and ESP32-C3.
2. **espressif/qemu `esp-develop`** @ `febae18` — the ESP32-C6 SoC models
   (and the newer RISC-V CPU, timer-group and systimer models they need).
   The files taken verbatim are listed in `qemu/esp32c6-files.txt`.
3. **`qemu/pinslim.patch`** (this repo), applied on top:
   - `hw/misc/picsimlab_api.c`: one shared implementation of the exported
     `qemu_picsimlab_*` functions; each machine registers its ops table, so
     several picsimlab machines can live in one library;
   - `esp32c6-picsimlab`: the Espressif C6 SoC plus IO_MUX, SAR ADC, LEDC
     and I²C with the host interface, 31 GPIOs;
   - `esp32s3-picsimlab`: the S3 SoC with a GPIO model using the real S3
     register layout (49 pins, two banks), the S3 SENS block for
     `analogRead()` (ADC1 = GPIO1-10, ADC2 = GPIO11-20) and the temperature
     sensor, LEDC with all 8 channels, I²C, and WiFi (the C3 MAC model plus
     its analog/PHY/FE stubs — the S3 uses the same MAC at the same address);
   - WiFi on the ESP32-C3: lcgamboa's MAC model is attached once the eFuse
     block is realized (it read the MAC address too early and aborted); the
     classic-ESP32 and C3 MAC models get distinct QOM types and per-device
     hooks so both fit into one library;
   - FUNCn_OUT_SEL resets to the "plain GPIO" signal on C3/C6/S3, and the
     LEDC model takes its channel count and `LEDC_CONF_REG` offset as
     properties (S3: 8 channels, C6: CONF at 0x1F0);
   - the ESP32 and ESP32-C3 picsimlab machines moved onto the shared API.

The libraries are linked the way lcgamboa's `build_libqemu-esp32.sh` does it
(every optional feature disabled, no PIE), then each `qemu-system-<arch>` is
relinked without `system/main.c.o` as `-shared`. Unlike lcgamboa's script,
Pinslim builds without `--enable-debug`; a `-O0` build makes the emulated
boards noticeably slower.

## Updating the patch

Work in a tree prepared like the script does (lcgamboa commit + files from
`esp32c6-files.txt` copied in), then:

```bash
git add -N <new files>
git diff -- $(git status --porcelain | awk '{print $2}' \
  | grep -vxFf qemu/esp32c6-files.txt) > qemu/pinslim.patch
```

## Known limits

- WiFi runs on the ESP32, ESP32-S3 and ESP32-C3 (NIC model `esp32_wifi` /
  `esp32c3_wifi`, emulated access points incl. "Velxio-GUEST"). The C6's
  WiFi 6 MAC and PHY are not modelled: its driver waits on undocumented PHY
  registers, so C6 WiFi sketches stop in `phy_init`.
- Bluetooth is not emulated on any chip.
- `qemu-system-xtensa` without `-M` aborts ("Multiple default machines",
  an upstream lcgamboa quirk); the worker always passes `-M`.

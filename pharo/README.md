# Pharo compatibility for SqueakJS

`startup-compat64.st` restores, at image startup, the classic VM display/input classes
that Pharo's **64-bit** builds no longer ship (they render exclusively through
SDL2/OSWindow via native FFI, which does not exist in the browser):

- `EventSensorConstants`, `InputEventHandler`, `InputEventSensor`, `InputEventFetcher`
  (classic VM event polling), the classic `HandMorph` event-queue methods,
- the classic `DisplayScreen` protocol (`beDisplay`, `forceToScreen:` …),
- `VMWorldRenderer` + its update modes (rendering via Display/BitBlt),
- cursor primitives (`beCursor`, `beCursorWithMask:`),

all extracted verbatim from the Pharo 10 32-bit build (which still ships them), then
reinstalls the UI (`UIManager default:` after clearing `MainWorldRenderer`).

**Usage:** name it `startup.st` and place it next to the `.image` (Pharo's
`StartupPreferencesLoader` runs it automatically). The hosted `Pharo64.zip` bundle
ships it that way. 32-bit Pharo images don't need it.

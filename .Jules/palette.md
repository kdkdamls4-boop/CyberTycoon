## 2024-05-18 - Associate Labels with Inputs for Checkboxes
**Learning:** Using `<span>` instead of `<label>` for checkbox descriptions in forms/settings prevents screen readers from announcing the checkbox purpose clearly. Furthermore, `<label for="[id]">` increases the effective clickable area, greatly improving usability for mouse/touch interactions without adding extra hit-area CSS.
**Action:** Always use `<label for="[id]">` (or `<label>` wrapping the input) for settings toggles and form inputs rather than generic text tags.

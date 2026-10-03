## 2024-05-15 - Labels for better a11y and hit areas
**Learning:** Found checkboxes in `index.html` associated with `<span>` text rather than `<label>` tags. This meant the text was not read by screen readers as associated with the input, and users had to click the tiny checkbox directly instead of the entire text string.
**Action:** Changed the `<span>` tags to `<label for="[id]">` to improve accessibility and make the text clickable for easier toggling.

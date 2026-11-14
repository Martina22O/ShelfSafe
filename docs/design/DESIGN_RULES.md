# ShelfSafe UI rules (strict)

1. The reference images in docs/design (not old/ and not _future/) are the source of truth for layout, spacing, sizes, colors, fonts, icons, copy and component shapes. Reproduce them as exactly as possible. Do not improve, simplify, reorder or add elements. Do not remove elements.
2. Never invent. If something is not visible in any reference (a state, a dialog, a screen width), do not guess silently: reuse the closest component from the same references and list it under "No reference" in your report.
3. Colors only from brand/colors.md. Fonts only the families and files in brand/fonts and typography.md. Measure colors from images with a script (never estimate by eye). A color seen in a reference but missing from colors.md is listed for my approval before use.
4. Real data always replaces the sample data in references (names, numbers, dates, prices). Keep the meaning of every label. If a reference label conflicts with the data model (for example the shorter category names, a duplicated label, or a number that cannot be right), keep the data-correct text and report the conflict.
5. Styling only. Do not change logic, data fetching, validation, navigation structure, security, database calls, or the meaning of error and confirmation messages. Never remove loading, empty, error or confirmation states. Truthful messages stay (for example "Password reset by email is not available yet").
6. Icons: use only the SVGs in docs/design/icons. For an icon that appears in a reference but has no file, first crop it from the highest-resolution reference if it is isolated, else recreate it as an SVG, and mark it "recreated, needs review". Never substitute icons from another icon library.
7. One reusable component per repeated element, and all colors, sizes, spacing and radii come from one theme file. No copied styling and no hardcoded hex values in screens.
8. Accessibility: keep every label, focus behaviour and tap target (at least 44 px on mobile). If a reference conflicts with this, follow the reference and report it.
9. Mobile references are phone width, web references are desktop width. For other widths derive a consistent layout and report it.
10. If a reference is unclear, low resolution or contradicts another, ask me. Do not guess.
11. After every task give a report: files changed; per screen "matches the reference" or the list of deviations with the reason; "No reference" list; conflicts found; new colors, fonts or packages that need my approval.


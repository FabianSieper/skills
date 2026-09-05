# Observation contract

Global IDs: browser.status, browser.inspect, browser.inspectRegion, browser.screenshot. They are independent of next and action preconditions. They use the same named attached session and precompiled transport.

status reports URL (query/fragment omitted), title and known pageState or unknown/outside-site. inspect returns limited visible headings, HTML/ARIA dialogs, important controls with role/name/disabled, registered region IDs and POM-allowlisted visibleData. It does not return input values, page HTML or an unrestricted snapshot. Outside the configured origin, only status metadata is available.

inspectRegion accepts a semantic region ID mapped by SitePage.regions(), never CSS or a locator. It returns only that region's projection. Unknown IDs fail UNKNOWN_REGION; missing/duplicate roots produce drift/ambiguity. Runtime does not invent new regions.

Default limits: eight entries per category, 100 characters per label, eight visibleData fields. Diagnostic inspect increases item limits and includes a bounded accessibility excerpt plus locator count/visibility. Full output remains subject to the byte limit. The generic role/name summary approximates accessibility names; the diagnostic Playwright excerpt can clarify differences. Browser-native JS alert/confirm prompts may block page operations; do not accept/dismiss them automatically, report the failure and request human handling.

Screenshot is explicitly requested, viewport-only and stored privately; return the file path, never base64 to the model. It can contain personal data and must not be packaged. Generic observation implementations may use fixed read-only DOM evaluation internally, but never expose eval, selectors, click, fill, coordinates, navigation or arbitrary code through the CLI.

When UI_DRIFT occurs, observe. If a known recovery action fits the observed state, use it. Otherwise report UNSUPPORTED_UI_STATE and switch to Builder/Repair only with a repair task. Diagnostic mode itself never repairs or mutates.

Verification must compare page/fixture state before and after every observe path, including diagnostic and screenshots. Test output caps, unknown states and region isolation. Do not mistake a protocol mock for a real browser test.

# Android import state and malformed picker recovery (Q018 partial)

A recreated Android Activity now refuses to trust an incomplete saved-state Bundle that omits the imported-document identity list. That key is written on every normal save, including when the list is empty. If it is missing or malformed, export destinations remain fail-closed rather than silently forgetting which imported ROMs must be protected.

The native file chooser also treats a malformed third-party `FileChooserParams.parseResult` response as a cancelled import. The outstanding picker ticket is consumed first; the WebView callback receives `null` and no unverified URI is registered.

Source-contract tests cover restoration ordering and callback behavior. These checks do not replace physical Android SAF provider, process-recreation, accessibility or authenticated ROM save/reopen acceptance.

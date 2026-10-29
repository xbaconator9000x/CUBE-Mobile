# Android export picker Activity-recreation gate

A user-selected Android `ACTION_CREATE_DOCUMENT` picker can outlive the Activity and its WebView session. After process/activity recreation, a late result must **never** become the document destination for a newer export request. The import picker already preserved this ticket; the export picker now does too.

`MainActivity` saves only whether a native export picker is outstanding, never a JavaScript session, document URI, ROM bytes or export payload. `NativeExport` restores a stale ticket in `ExportPickerGate`; while it is occupied, new export attempts fail closed. The late Android result consumes and discards the stale ticket. A subsequent new picker may then proceed normally. A WebView reload still invalidates its native export session without freeing a pending Android result.

This does not claim physical Android hardware acceptance or a signed production release. Unit tests cover recreated tickets, duplicate restoration, and new-session isolation; device/provider tests remain required.

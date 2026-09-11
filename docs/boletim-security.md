## Guest registration access

The public form uses POST `/api/guest-registration`. Direct Firestore access to
`alojamento_boletins` and all children is reserved to Miguel Maia's account
(`mnwi7SP84kZSXvxMPQz45RuvKG52`), including exclusion from the generic authenticated rule.

The server checks the parent and guests within a Firestore transaction. Access is
closed when `sentToAuthorities`, `publicAccessClosed`, or the expected guest count
indicates completion. Closed responses contain only `closed` and `language`.
The final save writes the guest, summary and closure atomically. Retrying a create
uses the same guest ID. Parent writes serialize concurrent final submissions.

Old sent and complete boletins are checked by the same endpoint. The one-time
`tests/boletim-live-check.cjs --close-sent` command additionally latches closure on
old sent records without deleting personal data. Unmarking sent in the admin UI
does not reopen a link. Corrections are available in the authenticated admin page.

Property selection is stored on the parent as `propertyId` (`123` or `1248`).
Old links without it remain usable and the administrator can associate a property.
Guest data keys and country codes remain compatible with the existing records.

The administrator can close a partially completed link without marking it sent,
change the expected guest count (never below the number already stored), and add
guest details received directly. Parent transactions serialize these operations
with public submissions. Increasing the count never reopens a closed link.
Manual additions are marked `enteredByAccommodation`, with no guest declaration
invented. They reset the sent flag and departure/retention confirmation so the new
guest is not missed in reporting. Closed-link text does not claim every guest
submitted a form. No document image upload or storage is introduced.

Guest check-in/check-out inherit each nonempty parent date; otherwise the guest
provides individual dates. Arrival is required; departure may be explicitly unknown.
The server validates dates and ignores attempts to override fixed parent dates.

The daily `deleteExpiredBoletins` scheduled function runs at 14:00 Europe/Lisbon.
The administrator explicitly confirms the last communication of all departures in
the group (`departureReportedDate`); `deleteAfter` is one calendar year from the
following day, at UTC noon. The group is removed atomically with all guests and
summaries. The cleanup revalidates the report date, guest completeness, dates and
closure inside the transaction, rather than trusting `deleteAfter` alone.
Correcting guest stay dates or unmarking sent clears the retention confirmation.
The admin list shows scheduled removals and records awaiting confirmation.
Existing records without a confirmed departure report date are never backfilled
or automatically removed. `authoritiesSentAt` alone does not schedule removal.

## Verification

Run `node --test tests/boletim-public.test.mjs` for translations and public API use.
For security tests, install Java 21, copy `firebase/firestore.rules` to
`tests/.runtime/firestore.rules`, then run:

```text
firebase emulators:exec --only firestore --project demo-boletim --config tests/boletim-emulator.json "node --test tests/boletim-security.test.cjs"
```

These tests fail closed if `FIRESTORE_EMULATOR_HOST` is absent and never use the
production project. `node tests/boletim-preview.mjs` provides synthetic browser
previews of the public and administrative pages on port 4173.

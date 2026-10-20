<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Barber↔service eligibility lives only in `barber_services`; never hardcode names. Why: staff/services change without code edits.
- Portraits resolve by `barbers.photo_url`, then slug map, then placeholder — never by array index. Why: order/staff count can change.
- `customers` is the central client record; appointments keep historical name/phone/email snapshots plus `customer_id`. Why: compatibility and future loyalty.
- Double booking is blocked by the `appointments_no_overlap` EXCLUDE constraint (confirmed only); server maps SQLSTATE 23P01 to a user message. Why: atomic protection.
- Admin writes on appointments/approvals go through `src/lib/admin.functions.ts` / `reviewCustomerApproval` with server-side has_role checks. Why: UI is not a security boundary.
- Revenue = SUM(amount_paid) of completed+paid appointments only (`src/lib/report.ts`, tested). Why: complimentary/pending must not count.
- Invite-code shortcut is isolated in `src/lib/invite.server.ts`. Why: removable later.
- Tests: `bunx vitest run --config vitest.config.ts`.
- Service amounts remain numeric with `price_from`; formatting is centralized in `servicePrice`. Why: consistent fixed/starting prices everywhere.
- Service editing uses authenticated `saveAdminService`; category changes synchronize `barber_services` from staff category eligibility. Why: new services inherit configurable eligibility without name checks.
- Slot math and working-window confirmation use pure `booking-rules`, with authoritative server checks on admin and public writes. Why: no accidental overtime or overlap regressions.
- Staff bootstrap is serialized by an auth lifecycle trigger; only the first self-service account or trusted server invitations can create staff. Why: UI hiding is not access control.

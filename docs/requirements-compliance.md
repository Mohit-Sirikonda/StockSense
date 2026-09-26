# StockSense requirements compliance

Reviewed and implemented on `codex/core-fixes-ui`, 26 September 2026. No commit or push was made. The existing industrial design and React StrictMode were preserved.

This report separates functional completion in the authorized browser-only demo from production capabilities that require a trusted service. **FULLY IMPLEMENTED (demo)** does not mean server-enforced identity, shared cloud storage, or real email delivery.

## Complete requirements matrix

| Requirement | Before this pass | Final status | Evidence / files | Work performed or remaining limitation |
| --- | --- | --- | --- | --- |
| Modular inventory application replacing scattered stock tracking | FULLY IMPLEMENTED | FULLY IMPLEMENTED (demo) | `src/App.tsx`, `src/context/InventoryContext.tsx`, `src/domain/inventory.ts` | Retained modular pages, shared inventory state, current-state commands and ledger. |
| Centralized, real-time shared inventory across users/devices | PARTIALLY IMPLEMENTED | PARTIALLY IMPLEMENTED | `src/services/storage.ts`, `src/context/InventoryContext.tsx` | The active workspace updates immediately after successful commands. Data is browser-local; no shared server, cross-device sync or concurrent-writer coordination. |
| Inventory Manager and Warehouse Staff workflows | FULLY IMPLEMENTED for bundled accounts | FULLY IMPLEMENTED (demo) | `src/data/users.ts`, `src/domain/permissions.ts`, `src/domain/accounts.ts` | Extended the same declared role policy to registered demo accounts. Staff can receive, process assigned deliveries, count assigned stock and transfer through their assigned location; cannot create delivery orders or manage master data. |
| User signup | MISSING | FULLY IMPLEMENTED (demo) | `src/pages/Login.tsx`, `src/domain/accounts.ts`, `src/utils/credentials.ts` | Added name/email/password/role/warehouse registration, duplicate email protection and persisted salted password verifiers. Roles are explicitly unverified demo choices. |
| Login, logout and correct session changes | FULLY IMPLEMENTED for bundled accounts | FULLY IMPLEMENTED (demo) | `src/context/AuthContext.tsx`, `src/domain/accounts.ts` | Added login for registered users and changed passwords. Save failures are reported; successful logout clears the saved session. |
| Redirect to Inventory Dashboard after authentication | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/App.tsx`, `src/pages/Login.tsx` | Existing redirect also applies after signup. Verified with both roles and reload. |
| OTP-based password reset that actually changes credentials | MISSING | FULLY IMPLEMENTED (demo); PARTIALLY IMPLEMENTED for real identity recovery | `src/domain/accounts.ts`, `src/utils/credentials.ts`, `src/pages/Login.tsx` | Six-digit demo OTP, five-minute expiry, five attempts, 30-second resend cooldown, one use. Successful reset replaces the verifier; old password fails. Real delivery and email ownership verification require a backend/provider. |
| Unauthorized pages and actions protected | FULLY IMPLEMENTED for bundled accounts | FULLY IMPLEMENTED within the demo policy; PARTIALLY IMPLEMENTED for production security | `src/App.tsx`, `src/domain/permissions.ts`, `src/context/InventoryContext.tsx` | Both UI and commands use the validated account directory. No client-only system can prevent its owner from editing local data/code. |
| Dashboard: Total Products in Stock | IMPLEMENTED BUT FUNCTIONALLY INCORRECT | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/pages/Dashboard.tsx` | Previously counted all products in scope, including zero stock. Now counts distinct SKUs with positive scoped stock; never sums unrelated UOM quantities. |
| Dashboard: Low Stock / Out of Stock Items | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/pages/Dashboard.tsx` | Retained `stock <= reorderLevel`; zero-stock items are identifiable. Added combined filter support. |
| Dashboard: Pending Receipts | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/dashboard.ts` | Counts matching Draft/Waiting/Ready receipts; excludes Done/Canceled. |
| Dashboard: Pending Deliveries | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/dashboard.ts` | Counts matching Draft/Waiting/Ready deliveries; excludes Done/Canceled. |
| Dashboard: Internal Transfers Scheduled | MISSING | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/pages/Dashboard.tsx`, `src/pages/Transfers.tsx` | Added compact KPI and scheduling UI. Scheduling persists work without moving stock; execution moves stock later. |
| Dashboard: Receipt/Delivery/Internal/Adjustment document filter | MISSING | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/pages/Dashboard.tsx` | One document selector filters operations, activity and related product summaries. Internal maps to Transfer. |
| Dashboard: Draft/Waiting/Ready/Done/Canceled status filter | MISSING | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/pages/Dashboard.tsx` | All five statuses are available. Ledger entries represent completed movements and appear for All/Done. |
| Dashboard: Warehouse/location filter | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/context/InventoryContext.tsx`, `src/domain/selectors.ts`, `src/pages/Dashboard.tsx` | Dashboard selector shares the global facility selection. Staff remain restricted to their assignment. |
| Dashboard: Product category filter and filter intersection | MISSING | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `tests/core.test.ts`, `tests/browser/compliance.spec.ts` | Category, document, status and warehouse work together. Current stock summaries narrow to products in matching documents when document/status filters are active; UI explains this. |
| Navigation: Products; Receipts; Delivery Orders; Adjustment; Move History; Dashboard; Warehouse Settings; My Profile; Logout | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/components/layout/TopNavigation.tsx`, `src/App.tsx` | Existing names are Products, Receipts, Deliveries, Stock counts, Stock ledger, Overview, Settings, profile/account and Sign out. Desktop and mobile navigation retained. |
| Product create/update: name, SKU/code, category, UOM | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/domain/inventory.ts` | Preserved working creation/editing and case-insensitive SKU uniqueness. Categories remain editable product classifications. |
| Optional initial stock | PARTIALLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/domain/inventory.ts` | Blank optional quantity now means zero. Positive opening stock still records a ledger movement. Invalid/negative values are rejected. |
| Stock availability per location | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/domain/selectors.ts` | Product details show balances by location; scoped views respect selected/assigned facility. |
| Product categories and category search/filter | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/pages/Dashboard.tsx` | Retained category creation through product editing and product category filters; added dashboard category filtering. No unnecessary separate taxonomy subsystem. |
| Reordering rule / threshold | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/domain/dashboard.ts`, `src/components/layout/TopNavigation.tsx` | Per-product nonnegative threshold drives scoped low-stock states and alerts. This is an alert rule, not automatic purchasing. |
| Receipts: supplier, products, received quantities, validation, automatic stock increase | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Receipts.tsx`, `src/domain/inventory.ts` | Preserved atomic receipt validation and snapshots. Added initial/open status selection, cancellation and SKU search. Completion writes stock/status/ledger together. |
| Deliveries: pick, pack, validate, automatic stock decrease | PARTIALLY IMPLEMENTED / stage handling incorrect | FULLY IMPLEMENTED | `src/pages/Deliveries.tsx`, `src/domain/inventory.ts` | Previously started Packed. Now Draft -> Picked/Waiting -> Packed/Ready -> Validated/Done. Commands reject stage skipping. Pick/pack do not move stock; dispatch does. Both table and detail actions tested. |
| Deliveries: insufficient stock and repeated-submission protection | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/inventory.ts`, `tests/core.test.ts`, `tests/browser/operations.spec.ts` | Preserved demand aggregation and atomic dispatch. Availability is rechecked during pick, pack and final validation. Duplicate validation cannot duplicate movement. |
| Transfers: warehouse to warehouse, warehouse to location, location to location | FULLY IMPLEMENTED for immediate movement; scheduling UI missing | FULLY IMPLEMENTED | `src/pages/Transfers.tsx`, `src/domain/inventory.ts` | Existing locations represent warehouses/floors/racks and can be either endpoint. Preserved single current-state transfer command, source decrease, destination increase, total-stock invariant and ledger. Added schedule/date/status/cancellation controls. |
| Adjustments: product/location, recorded vs physical quantity, difference, stock update and ledger | FULLY IMPLEMENTED; selection edge case found | FULLY IMPLEMENTED | `src/pages/Adjustments.tsx`, `src/domain/inventory.ts` | Retained current-state reconciliation. Physical count now resets when product/location changes even if recorded quantities are equal. Added SKU search. |
| Low-stock alerts update after movements | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/dashboard.ts`, `src/components/layout/TopNavigation.tsx`, `tests/browser/compliance.spec.ts` | Verified a count from 30 to 5 triggers a threshold-10 alert at the selected facility. |
| Multi-warehouse: separated balances, scope and operations | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/context/InventoryContext.tsx`, `src/domain/selectors.ts`, `src/pages/Settings.tsx` | Retained location master data, location-keyed balances, consistent filters and role boundaries. Registered staff assignments now also protect referenced locations and inventory resets. |
| SKU search and smart operational filters | PARTIALLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Products.tsx`, `src/pages/Receipts.tsx`, `src/pages/Deliveries.tsx`, `src/pages/Transfers.tsx`, `src/pages/Adjustments.tsx`, `src/pages/Ledger.tsx` | Product/ledger search retained; added SKU matching to operations, missing Canceled filters and transfer status control. |
| Ledger: all completed receipts/deliveries/transfers/adjustments traceable | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/inventory.ts`, `src/domain/selectors.ts`, `src/pages/Ledger.tsx` | Preserved signed quantities, transfer endpoints, chronological ordering, actor IDs and historical name/SKU/UOM snapshots. Scheduling/pick/pack/cancel create no movements. |
| Persistence after reload; validation and failure awareness | FULLY IMPLEMENTED for inventory | FULLY IMPLEMENTED for the browser workspace | `src/services/storage.ts`, `src/domain/validation.ts`, `src/domain/accounts.ts` | Preserved inventory validation, atomic publish-after-save and read-only legacy migration. Added validated account schema extension and rollback on failed account writes. |
| Product/location reference protection | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/domain/inventory.ts`, `src/domain/accounts.ts` | Retained historical/open-record deletion protection and UOM-change restrictions. Extended warehouse assignment checks to new accounts. |
| Profile changes must be truthful | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/pages/Profile.tsx`, `src/context/AuthContext.tsx` | Name/contact edits persist; email/role/assignment remain read-only. Recovery instructions now point to the working reset flow. Historical ledger attribution is unchanged. |
| CSV export with commas, quotes, newlines and special values | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/utils/csv.ts`, `src/pages/Ledger.tsx`, `tests/core.test.ts` | Preserved quoted fields, doubled quotes, multiline values, formula-text neutralization, numeric negatives and UTF-8 BOM. Download verified in browser. |
| Industrial UI, light/dark themes, responsive forms and usable errors | FULLY IMPLEMENTED | FULLY IMPLEMENTED | `src/index.css`, `src/pages/Login.tsx`, `tests/browser/workflows.spec.ts`, `tests/browser/compliance.spec.ts` | Added controls using existing visual language; retained compact KPI band/tables/palette. All major screens tested in both themes; signup and navigation checked at 390px. |

## Existing behavior deliberately preserved

- React StrictMode and the existing React/Vite/context architecture.
- Single synchronous inventory command owner using the latest committed state.
- Isolated command drafts: validate all results, persist once, then publish. Failed commands/writes leave visible stock unchanged.
- Persisted submission identifiers, terminal status checks, aggregated duplicate delivery lines and stock never clamped to hide a shortage.
- Master-data deletion protection, stable IDs, operation snapshots, historical ledger attribution and UOM restrictions.
- Existing seed records, including already packed historical/demo deliveries. New delivery staging does not rewrite them.
- Quantity summaries by UOM; no invented unit conversions or mixed-unit inventory totals.
- Existing scope selectors, guarded Settings access, profile persistence, CSV escaping and the HTTP-compatible UUID fallback.

## Exact files changed in this compliance pass

The working tree already contained uncommitted changes from the prior fixes/redesign. The list below identifies this pass, rather than attributing the entire branch diff to it.

| Files | Change |
| --- | --- |
| `src/domain/accounts.ts` (added) | Validated account directory/store, signup/login/profile/logout, queued credential changes, OTP lifecycle and persistence failure handling. |
| `src/utils/credentials.ts` (added) | Salted PBKDF2-SHA256 password/code verifiers using Web Crypto; explicit secure-origin errors. |
| `src/domain/dashboard.ts` (added) | Combined document/status/warehouse/category selectors and accurate KPI calculations. |
| `src/types/auth.ts` | Backward-compatible types for registered users, password verifiers and reset challenges. |
| `src/context/AuthContext.tsx` | Connect account commands, errors, registered account directory and session updates to React. |
| `src/services/storage.ts` | Validate/load/save extended accounts while retaining legacy profile/session compatibility. |
| `src/domain/permissions.ts` | Resolve capabilities using the validated bundled-plus-registered directory. |
| `src/domain/inventory.ts` | Pick/pack/cancel delivery commands, receipt statuses, transfer cancellation, registered-user permission/reference checks. |
| `src/context/InventoryContext.tsx` | Expose new commands and pass the current validated directory to the command store. |
| `src/pages/Login.tsx` | Signup and OTP forms, demo disclosures, busy/error states, unchanged visual system. |
| `src/pages/Profile.tsx` | Accurate instructions for password recovery. |
| `src/pages/Dashboard.tsx` | Five required KPIs, four combined filters, matching operations register and filtered stock/activity. |
| `src/pages/Deliveries.tsx` | Actual Draft/pick/pack/dispatch actions, cancellation, stage display and complete filters/search. |
| `src/pages/Receipts.tsx` | Initial/status editing controls, cancellation and SKU search. |
| `src/pages/Transfers.tsx` | Schedule/date controls, cancellation and status/SKU filters; preserved atomic execution. |
| `src/pages/Adjustments.tsx` | SKU search and count reset on equal-balance selection changes. |
| `src/pages/Products.tsx` | Blank optional initial stock and accessible filter names. |
| `src/index.css` | Five-column compact metric band and shared select styling; existing responsive/theme rules preserved. |
| `tests/core.test.ts` | 10 additional unit tests; 33 total. |
| `tests/browser/operations.spec.ts` | Existing delivery workflow now explicitly picks and packs. |
| `tests/browser/workflows.spec.ts` | Recovery expectation updated to assert truthful OTP demo behavior. |
| `tests/browser/compliance.spec.ts` (added) | Seven browser tests covering the complete requirements walkthrough and new edge cases. |
| `docs/requirements-compliance.md` (added) | This matrix, evidence, changes, test results and limitations. |

## Verification and results

| Check | Result |
| --- | --- |
| `npm.cmd run lint` | PASS. The repository's lint script is TypeScript `tsc --noEmit`; there is no separate ESLint configuration. |
| `npm.cmd run build` | PASS. Production assets generated. Existing Vite future-native-config `__dirname` warning remains visible. |
| `npm.cmd test` | PASS: 33 tests, 0 failures, 0 skipped. |
| `npm.cmd run test:browser` | PASS: 24 tests, 0 failures; Microsoft Edge via Playwright, 35.5 seconds. |
| `git diff --check` | PASS; Windows line-ending notices only. |
| Visual review | Dashboard, signup and password-reset screenshots reviewed in the existing light/dark language; narrow signup reviewed. Browser suite captures every major page in both themes. |

The browser suite interacts with actual navigation, forms, drawers and confirmations. It checks persisted balances/ledger as well as visible results; it does not inject inventory commands to simulate successful workflows. Failure tests deliberately mock storage errors or missing crypto APIs.

| Requested end-to-end step | Verified result |
| --- | --- |
| 1. Login | Bundled Manager, bundled Staff, registered Staff and registered Manager authenticate. |
| 2. Dashboard | Seed KPIs: 9 positive-stock SKUs, 3 alerts, 2 open receipts, 2 open deliveries, 1 scheduled transfer. |
| 3. Create product | QA-STL created with category Compliance, kg, reorder 10 and blank optional opening stock -> 0. Other browser test covers positive decimal opening stock. |
| 4-5. Receive and verify increase | Receipt for 50 kg validates -> Main Warehouse 50, one incoming ledger movement. |
| 6-7. Transfer and verify endpoints | Schedule 20 kg without moving stock; execute -> Main 30, Production 20, company total 50. |
| 8-9. Deliver and verify decrease | Delivery for 21 at Production is rejected; 10 is created, picked, packed, dispatched -> Main 30, Production 10, total 40. |
| 10. Stock adjustment | Count Main 30 -> 5 produces -25; total becomes 15. |
| 11. Ledger | Movements newest first: -25 adjustment, -10 delivery, 20 internal transfer, +50 receipt. Receipt retains the product name from before a later rename. |
| 12. Low-stock condition | Main 5 with reorder 10 appears in stock alerts and the attention table. |
| 13. SKU search | Case-insensitive QA-STL search returns the correct product and four ledger movements. |
| 14. Dashboard filters | Transfer + Waiting + Compliance + Main finds exactly the scheduled transfer; Done produces no matching scheduled row. Cancellation test verifies Canceled filtering. |
| 15. Warehouse/location switch | Main and Production show their separate 5/10 balances; global selection is consistent across every major inventory screen and survives reload. |
| 16. Role permissions | Staff cannot create products/orders or access Settings; assigned Staff can pick/pack/dispatch an order created by a registered Manager. Unit tests reject direct forbidden commands. |
| 17. Logout/login another account | Manager -> Staff and registered account reload/login verified; profile edits persist. |
| 18. OTP reset | Incorrect code rejected; correct code updates credential; old password rejected and new password works after reload. Unit tests also cover expiry, attempt limit, cooldown and replay. |
| 19. Refresh persistence | Each operation workflow reloads and compares the stored complete inventory. Account/profile/password state also survives reload. |
| 20. CSV export | Browser downloads real CSV with expected SKU, actor ID and negative quantity. Unit tests verify commas, embedded quotes, newlines, formula-like strings, null and nonfinite values. |

Additional regression coverage: repeat submissions, invalid transfer atomicity, same-render current-state execution, duplicate delivery demand, deletion protection, delivery stage skipping, shortages after packing, scheduling/cancellation without movements, registered staff location/reset references, corrupt saved inventory recovery, quota failures, and operation flows without `crypto.randomUUID`.

## Remaining limitations and unmet production requirements

1. **Shared centralized service: partially implemented.** This remains one browser-local workspace. It is not a multi-device or coordinated multi-tab database; concurrent tabs are not safe inventory writers. A shared transactional store and conflict control are needed for production centralization. No backend or P5 concurrency rewrite was introduced in this pass.
2. **Real OTP delivery and verified identity: partially implemented.** The demo inbox displays the code locally and explicitly says no email/SMS was sent. It demonstrates validation and actual credential changes, but cannot prove ownership of an email account. A trusted authentication service and delivery provider are required.
3. **Production authorization: partially implemented.** The app enforces the declared roles in UI and commands, but users control the browser runtime/localStorage. Demo signup permits an explicitly labelled unverified role choice. A server must own credentials, assignments and authorization for real deployment.
4. **Secure-origin dependency.** Web Crypto password hashing/verification requires HTTPS or localhost. On an ordinary HTTP LAN origin, original bundled credentials and stock operations remain usable; signup, reset and login using protected credentials report a clear error. Use localhost or HTTPS for the complete auth demo.
5. **Data durability.** Reload persistence is verified, but clearing browser storage removes local accounts/inventory. No automatic backup or cloud synchronization is claimed.
6. **Existing build warning.** Vite warns that `__dirname` in the existing config will not work with a future native config-loader default. Current type-check/build/tests pass; unrelated config modernization was not included.

There are no remaining known failures in the tested browser-demo workflows. The partially implemented production capabilities above are not represented as complete.

## Final architecture

React pages retain their existing local form state and industrial components. `AuthContext` exposes a small account command store; account identity and fixed role templates feed the existing permission policy. `InventoryContext` exposes the inventory command store and global warehouse scope. Inventory commands work on an isolated clone of current committed state, enforce permissions/invariants, write one validated snapshot and then publish to React. Pure selectors compute dashboard/filter/ledger views. `StorageService` owns local persistence and compatibility reads. No backend, new framework or state-management library was added.

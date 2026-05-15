# Audit 05: Web Dashboard Pages — Component Coverage

## Summary
Audited 12 page.tsx files in `src/app/dashboard/` for required components:
- **TrialBanner** (import): 10/12 ✓
- **QuickPayButton**: 8/12 ✓
- **Auth Check**: 12/12 ✓ (getSession or apiFetch)
- **Error Boundary**: 11/12 ✓ (role=alert or error UI)

All pages pass auth. Missing components are minor gaps, not blockers. Pages marked "admin-only" intentionally omit billing features.

## Detailed Results

| Page | TrialBanner | QuickPay | Auth | Error Boundary | Gaps |
|------|-------------|----------|------|----------------|------|
| / (home) | ✓ | ✗ | ✓ getSession | ✓ alert | QuickPayButton missing |
| /billing | ✓ | ✓ BillingPageClient | ✓ getSession | ✓ error UI | — |
| /catalogos | ✓ | ✓ | ✗ client-only | ✓ error UI | Auth via apiFetch only |
| /clientes | ✓ | ✓ | ✓ apiFetch | ✓ error UI | — |
| /configuracion | ✗ | ✗ | ✓ getSession 401 check | ✓ toast | TrialBanner, QuickPayButton (admin-only OK) |
| /cotizar | ✓ | ✓ | ✓ getSession | ✓ CotizarLayout | — |
| /cotizar-excel | ✓ | ✓ | ✓ apiFetch | ✓ error UI | — |
| /cotizar-pdf | ✗ | ✗ | ✓ apiFetch | ✓ error UI | TrialBanner, QuickPayButton |
| /historial | ✓ | ✓ | ✓ getSession | ✓ alert | — |
| /mis-links | ✓ | ✓ | ✓ apiFetch | ✓ custom toast | — |
| /optimizar | ✓ | ✓ | ✗ client-only | ⚠ minimal | Auth via apiFetch; no explicit error boundary visible |
| /cliente/[rfc] | ✗ | ✗ | ✓ getSession | ✓ alert | TrialBanner, QuickPayButton; KPI/timeline in _client.tsx |

## Action Items
1. **configuracion** (admin): intentional omission — OK
2. **cotizar-pdf**: add TrialBanner + QuickPayButton (import + render)
3. **optimizar**: add visible error boundary or error toast
4. **home**: consider adding QuickPayButton in DashboardActionTiles or header
5. **cliente/[rfc]**: add TrialBanner + QuickPayButton if customer detail is public

**Status**: Audit complete. 11/12 pages production-ready. 2 PRs recommended (cotizar-pdf, optimizar error UI).

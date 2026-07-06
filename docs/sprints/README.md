# Sprint Docs

Thu muc nay dung de tach checklist theo tung sprint cho qua trinh migration backend MySQL -> PostgreSQL.

## Quy trinh cho agent

Truoc khi lam bat ky sprint item nao, doc file chuan:

- [Quy trinh docs chuan cho agent](../quy-trinh-docs-cho-agent.md)

## Danh sach sprint

| Sprint | Ten | Trang thai | Tai lieu |
|---|---|---|---|
| Sprint 1 | PostgreSQL Migration Foundation | Done | [sprint-01-postgres-migration-foundation.md](./sprint-01-postgres-migration-foundation.md) |
| Sprint 2 | Coupon to Commerce PostgreSQL Migration | Done / Sprint 3 handoff complete | [sprint-02-coupon-commerce-handoff.md](./sprint-02-coupon-commerce-handoff.md) |
| Sprint 3 | Orders Core PostgreSQL Migration | Done / Sprint 4 handoff complete | [sprint-03-orders-core-postgres-migration.md](./sprint-03-orders-core-postgres-migration.md) |
| Sprint 4 | Catalog Products PostgreSQL Migration | Done / Sprint 5 handoff complete | [sprint-04-catalog-products-postgres-migration.md](./sprint-04-catalog-products-postgres-migration.md) |
| Sprint 5 | Social Comments PostgreSQL Migration | Done / Sprint 6 handoff complete | [sprint-05-social-comments-postgres-migration.md](./sprint-05-social-comments-postgres-migration.md) |
| Sprint 6 | Content News PostgreSQL Migration | Done / Sprint 7 handoff complete | [sprint-06-content-news-postgres-migration.md](./sprint-06-content-news-postgres-migration.md) |
| Sprint 7 | CRM Contact Forms PostgreSQL Migration | Done / Sprint 8 handoff complete | [sprint-07-crm-contactforms-postgres-migration.md](./sprint-07-crm-contactforms-postgres-migration.md) |
| Sprint 8 | Social Wishlists PostgreSQL Migration | Done / Sprint 9 handoff complete | [sprint-08-social-wishlists-postgres-migration.md](./sprint-08-social-wishlists-postgres-migration.md) |
| Sprint 9 | Catalog Variants PostgreSQL Migration | Done / Sprint 10 handoff complete | [sprint-09-catalog-variants-postgres-migration.md](./sprint-09-catalog-variants-postgres-migration.md) |
| Sprint 10 | Content News Categories PostgreSQL Migration | Done / Sprint 11 handoff complete | [sprint-10-content-newscategories-postgres-migration.md](./sprint-10-content-newscategories-postgres-migration.md) |
| Sprint 11 | Content Events PostgreSQL Migration | Done / Sprint 12 handoff complete | [sprint-11-content-events-postgres-migration.md](./sprint-11-content-events-postgres-migration.md) |
| Sprint 12 | Analytics Revenue PostgreSQL Migration | Done / Sprint 13 handoff complete | [sprint-12-analytics-revenue-postgres-migration.md](./sprint-12-analytics-revenue-postgres-migration.md) |
| Sprint 13 | Catalog Materials PostgreSQL Migration | Done / Sprint 14 handoff complete | [sprint-13-catalog-materials-postgres-migration.md](./sprint-13-catalog-materials-postgres-migration.md) |
| Sprint 14 | Notify Type PostgreSQL Migration | Done / Sprint 15 handoff complete | [sprint-14-notify-typenotify-postgres-migration.md](./sprint-14-notify-typenotify-postgres-migration.md) |
| Sprint 15 | Dashboard Debug Chat PostgreSQL Migration | Done / Sprint 16 handoff complete | [sprint-15-dashboard-debug-chat-postgres-migration.md](./sprint-15-dashboard-debug-chat-postgres-migration.md) |
| Sprint 16 | Regression Validation and Release Readiness | Done / Sprint 17 handoff complete | [sprint-16-regression-validation-release-readiness.md](./sprint-16-regression-validation-release-readiness.md) |
| Sprint 17 | Route QA/QC Full Coverage | Done / closed locally on 2026-06-26 | [sprint-17-route-qaqc-full-coverage.md](./sprint-17-route-qaqc-full-coverage.md) |
| Sprint 18 | Product Cloudinary Image Pipeline | In Progress | [sprint-18-product-cloudinary-image-pipeline.md](./sprint-18-product-cloudinary-image-pipeline.md) |

## Quy uoc cap nhat

- Moi sprint co mot file rieng trong thu muc `docs/sprints`.
- Moi checkbox chi duoc tick khi co evidence: command da chay, PR/commit, hoac ghi chu test tay.
- Sau moi ngay lam viec, cap nhat ca sprint doc va `docs/migration-tracker.md`.
- Neu phat sinh blocker, ghi vao "Blockers" trong sprint doc va dong bo vao blocker log cua tracker.
- Neu tat ca item trong "Definition of Done" va checklist scope cua sprint hien tai da `[x]`, agent phai tu dong:
  1. cap nhat sprint hien tai thanh `Done`,
  2. tao/active sprint tiep theo trong `docs/sprints`,
  3. cap nhat `docs/migration-tracker.md` voi next action cua sprint moi.

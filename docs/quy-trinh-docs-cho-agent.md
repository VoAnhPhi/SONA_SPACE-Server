# Quy Trinh Docs Chuan Cho Agent

- Project: `SONA_SPACE-Server`
- Ap dung cho: agent/AI/dev tham gia migration backend MySQL -> PostgreSQL
- Muc tieu: moi nguoi vao viec deu biet doc file nao, cap nhat file nao, va ban giao bang evidence nao
- Nguyen tac: docs la source-of-truth cho trang thai migration, khong chi la ghi chu phu

## 1. Thu Tu Doc Bat Buoc Khi Bat Dau

Moi agent khi nhan task migration phai doc theo thu tu nay:

1. `docs/migration-tracker.md`
   - Biet module nao dang `Done`, `In Progress`, `Blocked`.
   - Kiem tra daily log moi nhat.
   - Kiem tra blocker log.
2. `docs/sprints/README.md`
   - Biet sprint hien tai la sprint nao.
   - Mo dung file sprint can lam.
3. File sprint hien tai, vi du:
   - `docs/sprints/sprint-01-postgres-migration-foundation.md`
   - Biet goal, scope, checklist trong ngay, Definition of Done.
4. `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md`
   - Biet quy trinh migration theo phase.
   - Biet command van hanh va gate pass/fail.
5. `docs/bao-cao-migration-backend-mysql-to-postgresql.md`
   - Biet root cause, module uu tien, loi da tai hien.
6. Contract docs neu da ton tai:
   - `docs/db-contract-postgres.md`
   - `docs/mysql-to-postgres-column-mapping.md`

Neu mot file bat buoc chua ton tai, agent phai ghi vao sprint blocker va tao skeleton neu task hien tai can den file do.

## 2. Quy Tac Cap Nhat Docs Trong Khi Lam

Agent khong duoc chi sua code roi ket thuc. Moi task migration phai cap nhat docs tuong ung:

| Tinh huong | File can cap nhat |
|---|---|
| Bat dau hoac ket thuc mot ngay lam viec | `docs/migration-tracker.md`, file sprint hien tai |
| Hoan thanh mot checkbox sprint | File sprint hien tai |
| Hoan thanh mot module | `docs/migration-tracker.md` |
| Phat hien blocker schema/code/test | File sprint hien tai va blocker log trong `docs/migration-tracker.md` |
| Doi ten bang/cot hoac quyet dinh contract | `docs/db-contract-postgres.md`, `docs/mysql-to-postgres-column-mapping.md` |
| Them command, script, guard moi | `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md` |
| Doi cach setup/chay local | `README.md` va docs lien quan |

## 3. Evidence Bat Buoc

Khong tick checkbox neu khong co evidence. Evidence co the la:

- Command da chay va ket qua chinh.
- API smoke test va response tom tat.
- File da sua.
- PR/commit link neu co.
- Ghi chu test tay neu chua co automated test.
- Ly do neu mot item duoc dong lai ma khong sua code.

Mau evidence toi thieu:

```md
Evidence:

- Command: `npm run check:mysql-patterns`
- Result: failed, 835 findings
- Smoke: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`
- Files changed:
  - `routes/auth.js`
  - `docs/migration-tracker.md`
- Notes: `routes/auth.js` no longer appears in guard findings.
```

## 4. Quy Tac Tick Checklist

Chi tick `[x]` khi tat ca dieu kien sau dung:

- Viec da thuc hien xong trong code/docs.
- Da co evidence ngay ben duoi hoac trong daily log.
- Khong con blocker truc tiep cho item do.
- Neu co test/guard lien quan, da chay va ghi ket qua.

Neu item lam mot phan, giu `[ ]` va ghi tien do trong notes.

Vi du dung:

```md
- [x] `routes/auth.js` migration

Evidence:
- App smoke import passed: `APP_OK`
- Guard result: `routes/auth.js` not listed in current findings
```

Vi du chua dung:

```md
- [x] `routes/orders.js` migration
```

Ly do chua dung: khong co evidence, khong co test, khong ro endpoint nao da pass.

## 5. Mau Daily Log

Moi ngay lam viec them mot dong vao `docs/migration-tracker.md` va them note vao file sprint.

Mau cho file sprint:

```md
### YYYY-MM-DD

- Done:
- Guard count:
- Smoke/API evidence:
- Blockers:
- Next action:
```

Mau cho `docs/migration-tracker.md`:

```md
| YYYY-MM-DD | Owner | Module | Done Today | Blockers | Next Action |
|---|---|---|---|---|---|
| 2026-04-30 | TBD | Planning | Created Sprint 1 checklist; guard baseline 835; app smoke passed | Contract docs missing | Start Sprint 1 Day 1 |
```

## 6. Mau Blocker

Khi gap blocker, ghi ngan gon nhung phai co owner va next action.

```md
| ID | Date | Module | Blocker | Severity | Owner | ETA | Status |
|---|---|---|---|---|---|---|---|
| B-003 | 2026-04-30 | Schema | `payments` table does not match route expectations | High | TBD | TBD | Open |
```

Severity guideline:

- `Critical`: chan luong chinh hoac app khong khoi dong.
- `High`: chan module P0 hoac lam guard khong the pass.
- `Medium`: anh huong docs/setup/legacy nhung co workaround.
- `Low`: cleanup, wording, hoac viec khong chan sprint.

## 7. Mau Sprint Doc Moi

Moi sprint moi nen tao file:

```text
docs/sprints/sprint-XX-short-name.md
```

Skeleton:

```md
# Sprint X - Ten Sprint

- Project:
- Prepared date:
- Duration:
- Current status:
- Source docs:

## 1. Current Snapshot

### Done

- [ ]

### Not Done Yet

- [ ]

## 2. Baseline Metrics

- Command:
- Result:

## 3. Sprint Goal

- [ ]

## 4. In Scope

- [ ]

## 5. Out of Scope

- [ ]

## 6. Day-by-Day Checklist

### Day 1

- [ ]

Evidence:

- Command output:
- PR/commit:
- Notes:

## 7. Definition of Done

- [ ]

## 8. Next Sprint Entry Criteria

- [ ]

## 9. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
```

Sau khi tao sprint doc moi, cap nhat:

- `docs/sprints/README.md`
- `docs/migration-tracker.md` phan Related docs neu sprint do dang active

## 8. Quy Trinh Cho Mot Task Migration

1. Doc docs theo thu tu trong muc 1.
2. Xac dinh module va sprint checklist lien quan.
3. Chay baseline neu task co lien quan code:

```bash
npm run check:mysql-patterns
node -e "require('./app'); console.log('APP_OK'); process.exit(0)"
```

4. Sua code/docs theo scope.
5. Chay lai command lien quan:

```bash
npm run check:mysql-patterns
node -e "require('./app'); console.log('APP_OK'); process.exit(0)"
```

6. Cap nhat sprint doc:
   - Tick item da xong.
   - Ghi evidence.
   - Ghi blocker neu co.
7. Cap nhat `docs/migration-tracker.md`:
   - Module status.
   - Daily execution log.
   - Blocker log neu co.
8. Ket thuc bang tom tat ngan:
   - Da lam gi.
   - Da verify gi.
   - Con gi tiep theo.

## 9. Checklist Ban Giao Cho Agent Tiep Theo

Truoc khi ket thuc task, agent phai dam bao:

- [ ] File sprint hien tai da cap nhat.
- [ ] `docs/migration-tracker.md` da cap nhat neu co thay doi trang thai.
- [ ] Blocker moi da co owner/next action.
- [ ] Command da chay duoc ghi lai.
- [ ] File thay doi quan trong duoc liet ke trong final summary.
- [ ] Neu guard van fail, ghi count moi nhat va top file con lai.

## 10. Quy Uoc Duong Dan

Dung duong dan trong server repo:

- Dung: `SONA_SPACE-Server/docs/sprints/...`
- Dung khi dang o root server: `docs/sprints/...`
- Khong tao docs o root workspace `Sona/docs/...` cho task server.

Neu phat hien file docs nam sai root workspace, di chuyen ve `SONA_SPACE-Server/docs/...` va xoa thu muc thua neu rong.

## 11. Quy Tac Tu Dong Chuyen Sprint

Khi sprint hien tai da hoan tat (tat ca item trong scope/day checklist/definition of done da `[x]`), agent phai tu dong chuyen sprint tiep theo, khong doi nhac lai:

1. Cap nhat trang thai sprint hien tai thanh `Done` trong file sprint va `docs/sprints/README.md`.
2. Tao hoac active file sprint tiep theo trong `docs/sprints/`.
3. Cap nhat `docs/migration-tracker.md`:
   - Them link sprint moi vao phan related docs neu can.
   - Them daily log cho ngay chuyen sprint.
   - Cap nhat "Next Action" theo sprint moi.
4. Neu chua du dieu kien chuyen sprint, giu sprint hien tai o `In Progress` va ghi ro blocker.

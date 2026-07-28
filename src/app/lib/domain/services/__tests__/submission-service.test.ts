import { describe, it, expect } from "vitest";
import {
  getMaxUploads, computeOdevYuzdeleri, combineOdevYuzdesi,
  ODEV_TUR_AGIRLIK, type OdevYuzdeleriResult,
} from "../submission-service";
import type { Assignment } from "../../core/assignment";
import type { Submission } from "../../core/submission";
import type { AssignmentRepo } from "../../repo/assignment-repo";
import type { SubmissionRepo } from "../../repo/submission-repo";

const TENANT = "tenant-1";
const GROUP_ID = "group-1";

describe("submission-service :: getMaxUploads", () => {
  it("completed durumunda 0 (kilitli) döner", () => {
    expect(getMaxUploads("completed")).toBe(0);
  });
  it("revision durumunda 8 (5 temel + 3 revizyon) döner", () => {
    expect(getMaxUploads("revision")).toBe(8);
  });
  it("diğer durumlarda (submitted/null) 5 döner", () => {
    expect(getMaxUploads(null)).toBe(5);
    expect(getMaxUploads("submitted")).toBe(5);
  });
});

describe("submission-service :: combineOdevYuzdesi", () => {
  it("her iki kategori de boşsa (veri yok) null döner", () => {
    const result: OdevYuzdeleriResult = { normal: { totalMaxPuan: 0, earnedByPerson: {} }, proje: { totalMaxPuan: 0, earnedByPerson: {} } };
    expect(combineOdevYuzdesi(result, "p1")).toBeNull();
  });

  it("sadece normal kategori varsa (bugünkü GERÇEK durum — proje hesaba hiç girmiyor) doğrudan normal yüzdesi döner, ağırlık uygulanmaz", () => {
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 200, earnedByPerson: { p1: 150 } },
      proje: { totalMaxPuan: 0, earnedByPerson: {} },
    };
    // 150/200 = %75 — ODEV_TUR_AGIRLIK.normal (30) ile ÇARPILMAZ, tek kategori kendi başına %100 ağırlıklı.
    expect(combineOdevYuzdesi(result, "p1")).toBe(75);
  });

  it("sadece proje kategorisi varsa doğrudan proje yüzdesi döner", () => {
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 0, earnedByPerson: {} },
      proje: { totalMaxPuan: 100, earnedByPerson: { p1: 90 } },
    };
    expect(combineOdevYuzdesi(result, "p1")).toBe(90);
  });

  it("her iki kategori de doluysa normal(%30)+proje(%70) ağırlıklı ortalama alınır", () => {
    expect(ODEV_TUR_AGIRLIK).toEqual({ normal: 30, proje: 70 });
    const result: OdevYuzdeleriResult = {
      normal: { totalMaxPuan: 100, earnedByPerson: { p1: 100 } }, // %100
      proje: { totalMaxPuan: 100, earnedByPerson: { p1: 50 } },   // %50
    };
    // 1.00*30 + 0.50*70 = 30 + 35 = 65
    expect(combineOdevYuzdesi(result, "p1")).toBe(65);
  });

  it("kişinin hiç puanı yoksa (earnedByPerson'da yok) 0 puan varsayılır", () => {
    const result: OdevYuzdeleriResult = { normal: { totalMaxPuan: 100, earnedByPerson: {} }, proje: { totalMaxPuan: 0, earnedByPerson: {} } };
    expect(combineOdevYuzdesi(result, "hic-teslim-etmedi")).toBe(0);
  });
});

describe("submission-service :: computeOdevYuzdeleri", () => {
  function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
    return {
      id: "a1", tenantId: TENANT, groupId: GROUP_ID, title: "Ödev", status: "published",
      maxPuan: 100, createdAt: "2026-01-01T00:00:00.000Z", createdBy: "trainer-1",
      ...overrides,
    } as Assignment;
  }
  function makeSubmission(overrides: Partial<Submission> = {}): Submission {
    return {
      id: "s1", tenantId: TENANT, assignmentId: "a1", personId: "p1",
      status: "completed", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "p1",
      ...overrides,
    } as Submission;
  }

  function makeDeps(assignments: Assignment[], submissions: Submission[]) {
    const assignmentRepo: Pick<AssignmentRepo, "list"> = {
      list: async () => assignments,
    };
    const submissionRepo: Pick<SubmissionRepo, "listByGroup"> = {
      listByGroup: async () => submissions,
    };
    return { assignments: assignmentRepo as AssignmentRepo, submissions: submissionRepo as SubmissionRepo };
  }

  it("draft durumundaki ödevler payda/paya HİÇ dahil edilmez", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "draft", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: 80 })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(0);
    expect(result.normal.earnedByPerson.p1).toBeUndefined();
  });

  it("kind=proje olan ödevler bilinçli olarak HİÇ hesaba girmez (2026-07-17 kararı)", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "published", kind: "proje", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: 90 })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.proje.totalMaxPuan).toBe(0);
    expect(result.normal.totalMaxPuan).toBe(0);
  });

  it("published/closed/archived hepsi payda'ya dahil olur, SADECE draft hariç", async () => {
    const deps = makeDeps(
      [
        makeAssignment({ id: "a1", status: "published", maxPuan: 100 }),
        makeAssignment({ id: "a2", status: "closed", maxPuan: 50 }),
        makeAssignment({ id: "a3", status: "archived", maxPuan: 50 }),
      ],
      [],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(200);
  });

  it("notu olmayan (grade=null/undefined) teslimler paya dahil edilmez", async () => {
    const deps = makeDeps(
      [makeAssignment({ id: "a1", status: "published", maxPuan: 100 })],
      [makeSubmission({ assignmentId: "a1", personId: "p1", grade: undefined })],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.earnedByPerson.p1).toBeUndefined();
  });

  it("birden fazla ödevin notları AYNI kişi için toplanır", async () => {
    const deps = makeDeps(
      [
        makeAssignment({ id: "a1", status: "published", maxPuan: 100 }),
        makeAssignment({ id: "a2", status: "published", maxPuan: 100 }),
      ],
      [
        makeSubmission({ assignmentId: "a1", personId: "p1", grade: 80 }),
        makeSubmission({ assignmentId: "a2", personId: "p1", grade: 60 }),
      ],
    );
    const result = await computeOdevYuzdeleri(TENANT, GROUP_ID, deps);
    expect(result.normal.totalMaxPuan).toBe(200);
    expect(result.normal.earnedByPerson.p1).toBe(140);
    expect(combineOdevYuzdesi(result, "p1")).toBe(70); // 140/200 = %70
  });
});

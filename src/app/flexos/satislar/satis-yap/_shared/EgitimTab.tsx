"use client";

import { FlexSpinner } from "../../../_components/FlexSpinner";
import { BranchDoc, BundleDoc, CampaignDoc, EducationDoc, SectionDoc, TrackDoc } from "./types";
import { S, IC, navyBox } from "./constants";
import { SectionTitle, Label, SelectWrap } from "./ui";

interface TreeNode { sec: SectionDoc; tracks: TrackDoc[] }
interface ProgramItem { no: string; name: string; topics: string; sure: string }

interface EgitimTabProps {
  satisModu: "bireysel" | "paket";
  onSelectBireysel: () => void;
  onSelectPaket: () => void;

  branches: BranchDoc[];
  brans: string;
  onBransChange: (id: string) => void;
  educations: EducationDoc[];
  egitim: string;
  onEgitimChange: (id: string) => void;
  loadingEdu: boolean;

  kampanya: string;
  setKampanya: (v: string) => void;
  campaigns: CampaignDoc[];

  paketId: string;
  setPaketId: (v: string) => void;
  bundles: BundleDoc[];
  loadingBundles: boolean;
  selBundle: BundleDoc | undefined;

  satisNedeni: string;
  setSatisNedeni: (v: string) => void;
  effModel: "full" | "track";
  setSatisModeli: (v: "full" | "track") => void;
  modelLocked: boolean;
  teslimSekli: "in_person" | "online";
  setTeslimSekli: (v: "in_person" | "online") => void;
  teslimLocked: boolean;
  hybridOptions: { mode: "in_person" | "online"; listPrice: number }[];

  hicSecimYok: boolean;

  showTrackTree: boolean;
  loadingTree: boolean;
  tree: TreeNode[];
  selTrackCount: number;
  selTrackSaat: number;
  trackOn: (id: string) => boolean;
  toggleTrack: (id: string) => void;
  allOnOf: (ids: string[]) => boolean;
  someOnOf: (ids: string[]) => boolean;
  setManyTracks: (ids: string[], val: boolean) => void;

  showIcerik: boolean;
  icerikBaslik: string;
  icerikOzet: string;
  fullHours: number;
  trackBased: boolean;
  programItems: ProgramItem[];
  selEdu: EducationDoc | undefined;
}

/** Satış Yap · Tab 2 — Bireysel/Paket satış modu, branş/eğitim/kampanya, Track Bazlı seçim ağacı, eğitim içeriği. */
export function EgitimTab({
  satisModu, onSelectBireysel, onSelectPaket,
  branches, brans, onBransChange, educations, egitim, onEgitimChange, loadingEdu,
  kampanya, setKampanya, campaigns,
  paketId, setPaketId, bundles, loadingBundles, selBundle,
  satisNedeni, setSatisNedeni, effModel, setSatisModeli, modelLocked,
  teslimSekli, setTeslimSekli, teslimLocked, hybridOptions,
  hicSecimYok,
  showTrackTree, loadingTree, tree, selTrackCount, selTrackSaat, trackOn, toggleTrack, allOnOf, someOnOf, setManyTracks,
  showIcerik, icerikBaslik, icerikOzet, fullHours, trackBased, programItems, selEdu,
}: EgitimTabProps) {
  return (
    <>
      {/* Satış Modu toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <button type="button"
          onClick={onSelectBireysel}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", transition: "all .15s",
            ...(satisModu === "bireysel" ? { background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", boxShadow: "0 4px 12px -4px rgba(32,82,151,.4)" } : { background: "#eef2f8", color: "#64748b" }) }}>
          <span dangerouslySetInnerHTML={{ __html: IC.user }} />Bireysel Eğitim
        </button>
        <button type="button"
          onClick={onSelectPaket}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 18px", borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", transition: "all .15s",
            ...(satisModu === "paket" ? { background: "linear-gradient(135deg,#2867bd,#205297)", color: "#fff", boxShadow: "0 4px 12px -4px rgba(32,82,151,.4)" } : { background: "#eef2f8", color: "#64748b" }) }}>
          <span dangerouslySetInnerHTML={{ __html: IC.layers }} />Paket Satışı
        </button>
      </div>

      {/* ── BİREYSEL MOD: Branş + Eğitim + Kampanya ── */}
      {satisModu === "bireysel" && (<>
      <SectionTitle>Eğitim &amp; Kampanya</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
        <div>
          <Label>Branş</Label>
          <SelectWrap small>
            <select value={brans} onChange={(e) => onBransChange(e.target.value)} style={S.selectSm}>
              <option value="">Branş Seçin</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </SelectWrap>
        </div>
        <div style={{ opacity: !brans ? 0.5 : 1 }}>
          <Label withLock={!brans}>Eğitim</Label>
          <SelectWrap small>
            <select value={egitim} onChange={(e) => onEgitimChange(e.target.value)} disabled={!brans || loadingEdu}
              style={{ ...S.selectSm, fontSize: 13, background: !brans ? "#f1f5f9" : "#f8fafc", cursor: !brans ? "not-allowed" : "pointer" }}>
              <option value="">{loadingEdu ? "Yükleniyor…" : educations.length ? "Eğitim Seçin" : "Bu branşta eğitim yok"}</option>
              {educations.map((ed) => <option key={ed.id} value={ed.id}>{ed.name}</option>)}
            </select>
          </SelectWrap>
        </div>
        <div>
          <Label>Kampanya</Label>
          <SelectWrap small>
            <select value={kampanya} onChange={(e) => setKampanya(e.target.value)} style={S.selectSm}>
              <option value="">Kampanya Seçin</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="erken">Erken Kayıt — %15 İndirim</option>
              <option value="referans">Referans İndirimi — %10</option>
            </select>
          </SelectWrap>
        </div>
      </div>
      </>)}

      {/* ── PAKET MOD: Paket seçici ── */}
      {satisModu === "paket" && (<>
      <SectionTitle>Paket Seçimi</SectionTitle>
      <div style={{ marginBottom: 20 }}>
        <Label>Paket</Label>
        <SelectWrap small>
          <select value={paketId} onChange={(e) => setPaketId(e.target.value)} style={{ ...S.selectSm, maxWidth: 420 }}>
            <option value="">{loadingBundles ? "Yükleniyor…" : bundles.length ? "Paket Seçin" : "Aktif paket bulunamadı"}</option>
            {bundles.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </SelectWrap>
      </div>

      {/* Paket içerik kartı */}
      {selBundle && (
        <div style={{ border: "1px solid #dce6f5", borderRadius: 16, overflow: "hidden", marginBottom: 16, animation: "sy-slide .25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", background: "linear-gradient(135deg,#f0f5ff,#e8f0ff)", borderBottom: "1px solid #dce6f5" }}>
            <span style={{ ...S.boxIcon, background: "#dbe3ff", color: "#1e3a8a" }} dangerouslySetInnerHTML={{ __html: IC.layers }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>{selBundle.name}</div>
              <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>{selBundle.items.length} eğitim dahil</div>
            </div>
          </div>
          <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {selBundle.items.map((item, idx) => (
              <div key={item.educationId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 11, background: "#f8fafc", border: "1px solid #eef1f6" }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "#EBF2FF", color: "#205297", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{item.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "2px 9px", borderRadius: 7, flexShrink: 0 }}>{item.brans}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24, maxWidth: 860, ...(satisModu === "paket" ? { display: "none" } : {}) }}>
        <div>
          <Label>Satış Tipi</Label>
          <SelectWrap small>
            <select value={satisNedeni} onChange={(e) => setSatisNedeni(e.target.value)} style={S.selectSm}>
              <option value="Yeni Satış">Yeni Satış</option>
              <option value="Tekrar Öğrencisi">Tekrar Öğrencisi</option>
              <option value="Sınıf Değişimi">Sınıf Değişimi</option>
            </select>
          </SelectWrap>
        </div>
        <div style={{ opacity: modelLocked ? 0.6 : 1 }}>
          <Label withLock={modelLocked}>Satış Modeli</Label>
          <SelectWrap small>
            <select value={effModel} onChange={(e) => setSatisModeli(e.target.value as "full" | "track")} disabled={modelLocked}
              style={{ ...S.selectSm, background: modelLocked ? "#f1f5f9" : "#f8fafc", cursor: modelLocked ? "not-allowed" : "pointer" }}>
              <option value="full">Full Paket</option>
              <option value="track">Track Bazlı</option>
            </select>
          </SelectWrap>
        </div>
        <div style={{ opacity: teslimLocked ? 0.6 : 1 }}>
          <Label withLock={teslimLocked}>Eğitim Modeli</Label>
          <SelectWrap small>
            <select value={teslimSekli} onChange={(e) => setTeslimSekli(e.target.value as "in_person" | "online")} disabled={teslimLocked}
              style={{ ...S.selectSm, background: teslimLocked ? "#f1f5f9" : "#f8fafc", cursor: teslimLocked ? "not-allowed" : "pointer" }}>
              {(teslimLocked || hybridOptions.some((o) => o.mode === "in_person")) && <option value="in_person">Yüz Yüze</option>}
              {(teslimLocked || hybridOptions.some((o) => o.mode === "online")) && <option value="online">Online</option>}
            </select>
          </SelectWrap>
        </div>
      </div>

      {/* Empty state */}
      {hicSecimYok && (
        <div style={S.emptyBox}>
          <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.boxBig }} />
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>Henüz eğitim seçilmedi</div>
          <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 320 }}>Önce branş, ardından eğitim seçtiğinizde içerik ve kapsam burada görüntülenir.</div>
        </div>
      )}

      {/* Track ağacı yükleniyor */}
      {showTrackTree && loadingTree && (
        <div style={{ ...S.emptyBox, padding: "36px 20px" }}>
          <FlexSpinner />
          <div style={{ fontSize: 13, color: "#94a3b8" }}>İçerik yükleniyor…</div>
        </div>
      )}

      {/* Track Bazlı seçim ağacı — bölümler + trackler tek tek (lacivert checkbox) */}
      {showTrackTree && !loadingTree && tree.length > 0 && (
        <div style={{ border: "1px solid #e9edf4", borderRadius: 16, overflow: "hidden", marginBottom: 16, animation: "sy-slide .25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", background: "linear-gradient(135deg,#f4f7ff,#eef2ff)", borderBottom: "1px solid #e4e9f7" }}>
            <span style={{ ...S.boxIcon, background: "#dbe3ff", color: "#1e3a8a" }} dangerouslySetInnerHTML={{ __html: IC.layers }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>Bölüm &amp; Track Seçimi</div>
              <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>Kursiyere satılacak bölümleri ve track&apos;leri tek tek seçin.</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a", background: "#dbe3ff", padding: "4px 11px", borderRadius: 999 }}>{selTrackCount} track · {selTrackSaat} saat</span>
          </div>
          <div style={{ padding: "12px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            {tree.map((node) => {
              const ids = node.tracks.map((t) => t.id);
              const allOn = allOnOf(ids);
              const someOn = someOnOf(ids);
              return (
                <div key={node.sec.id}>
                  {/* Bölüm satırı */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, background: someOn ? "#f5f7ff" : "#f8fafc", border: "1px solid #e9edf4" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: "1px solid #e6eaf1", color: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }} dangerouslySetInnerHTML={{ __html: IC.folderSm }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>{node.sec.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{node.tracks.length} track{node.sec.hours ? ` · ${node.sec.hours} saat` : ""}</div>
                    </div>
                    {ids.length > 0 && (
                      <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setManyTracks(ids, !allOn)} style={navyBox(allOn, someOn && !allOn)}>
                        {allOn ? <span dangerouslySetInnerHTML={{ __html: IC.check }} /> : someOn ? <span style={{ width: 10, height: 2.5, borderRadius: 2, background: "#fff" }} /> : null}
                      </span>
                    )}
                  </div>
                  {/* Track satırları */}
                  {node.tracks.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "4px 0 0 14px", paddingLeft: 14, borderLeft: "1px solid #e9edf4" }}>
                      {node.tracks.map((t) => {
                        const on = trackOn(t.id);
                        return (
                          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} key={t.id} onClick={() => toggleTrack(t.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, cursor: "pointer", userSelect: "none", background: on ? "#f8faff" : "transparent", transition: "background .14s" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{t.name}</div>
                            </div>
                            {t.hours ? <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "3px 9px", borderRadius: 8, flex: "0 0 auto" }}>{t.hours} saat</span> : null}
                            <span style={navyBox(on, false)}>{on && <span dangerouslySetInnerHTML={{ __html: IC.check }} />}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Eğitim İçeriği */}
      {showIcerik && !showTrackTree && (
        <div style={{ border: "1px solid #e9edf4", borderRadius: 16, overflow: "hidden", marginBottom: 2, animation: "sy-slide .25s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 20px", background: "linear-gradient(135deg,#fffaf4,#fff5ec)", borderBottom: "1px solid #f3e8da" }}>
            <span style={{ ...S.boxIcon, background: "#ffedd5", color: "#c2410c" }} dangerouslySetInnerHTML={{ __html: IC.bookSm }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#0f1f3d" }}>Eğitim İçeriği</div>
              <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>{icerikBaslik}</div>
            </div>
          </div>
          <div style={{ padding: "18px 20px 20px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              {fullHours > 0 && <span style={S.chip}><span dangerouslySetInnerHTML={{ __html: IC.clock }} />{fullHours} saat</span>}
              <span style={S.chip}><span dangerouslySetInnerHTML={{ __html: IC.signal }} />{trackBased ? "Bölümlü Eğitim" : "Tek Eğitim"}</span>
              <span style={{ ...S.chip, color: "#15803d", background: "#dcfce7" }}><span dangerouslySetInnerHTML={{ __html: IC.awardGreen }} />Sertifikalı</span>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#475569", lineHeight: 1.65 }}>{icerikOzet}</p>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>{trackBased ? "BÖLÜMLER" : "PROGRAM İÇERİĞİ"}</div>
            {trackBased ? (
              programItems.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, padding: "4px 2px" }}>Bu eğitim için içerik bilgisi henüz girilmemiş.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {programItems.map((m) => (
                    <div key={m.no} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "#f8fafc", border: "1px solid #eef1f6", borderRadius: 12 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: "1px solid #e6eaf1", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flex: "0 0 auto" }}>{m.no}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                        {m.topics && <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>{m.topics}</div>}
                      </div>
                      {m.sure && <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", background: "#eef2f8", padding: "4px 10px", borderRadius: 8, flex: "0 0 auto" }}>{m.sure}</span>}
                    </div>
                  ))}
                </div>
              )
            ) : selEdu?.outline?.[0] ? (
              <>
                <style>{`.sy-rt h1,.sy-rt h2,.sy-rt h3,.sy-rt h4,.sy-rt h5,.sy-rt h6{margin:12px 0 6px;font-weight:700;color:#0f1f3d}.sy-rt h1{font-size:17px}.sy-rt h2{font-size:15.5px}.sy-rt h3{font-size:14px}.sy-rt h4,.sy-rt h5,.sy-rt h6{font-size:13.5px}.sy-rt p{margin:0 0 10px}.sy-rt ul,.sy-rt ol{margin:6px 0 10px;padding-left:20px}.sy-rt li{margin-bottom:4px}.sy-rt strong{font-weight:700}.sy-rt em{font-style:italic}`}</style>
                <div className="sy-rt" style={{ fontSize: 13.5, color: "#1e293b", lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: selEdu.outline[0] }} />
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, padding: "4px 2px" }}>Bu eğitim için içerik bilgisi henüz girilmemiş.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import React, { useEffect } from "react";
import { Plus, Info, X, Users, PlusCircle, Search, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { GlobalConfirmationModal, StudentDeleteModal } from "./management-components/Modals";
import { StudentTable } from "./student-management/StudentTable";
import { GroupCards } from "./class-management/GroupCards";
import { GroupForm } from "./class-management/GroupForm";
import { StudentForm } from "./student-management/StudentForm";
import { useManagement } from "@/app/hooks/useManagement";

export default function ManagementContent({ setHeaderTitle }: { setHeaderTitle: (t: string) => void }) {
  const {
    isAdmin, currentView, setCurrentView, editingStudent, avatarId, setAvatarId,
    isFormOpen, deleteModal, setDeleteModal,
    selectedStudentIds, setSelectedStudentIds, students, groups,
    selectedGroupId, setSelectedGroupId, openMenuId, setOpenMenuId,
    editingGroupId, groupCode, setGroupCode,
    groupBranch, setGroupBranch,
    groupModule, setGroupModule, moduleBlockModal, setModuleBlockModal,
    instructors, selectedInstructorId, setSelectedInstructorId,
    selectedSchedule, setSelectedSchedule, customSchedule, setCustomSchedule,
    isScheduleOpen, setIsScheduleOpen, errors, setErrors,
    searchQuery, setSearchQuery, isStudentFormOpen, setIsStudentFormOpen,
    studentName, setStudentName, studentLastName, setStudentLastName,
    studentEmail, setStudentEmail, studentNote, setStudentNote,
    studentBranch, setStudentBranch, studentError, setStudentError,
    viewMode, setViewMode, toast, setToast, selectedGroupIdForStudent, setSelectedGroupIdForStudent,
    modalConfig, setModalConfig, isProcessing, scheduleRef, menuRef, schedules,
    handleOpenForm, handleCancel, handleSave, handleEdit, requestModal, requestBulkDeleteArchive, confirmModalAction, formRef,
    handleAddStudent, handleDeleteStudent, handleBulkDeleteStudents, handleEditStudent, resetStudentForm, setEditingStudentId,
    handleGraduateStudent, handleBulkGraduateStudents, handleRestoreStudent, handleDeleteGraduatedStudent,
    filteredGroups, filteredArchiveGroups, filteredStudents, pagedStudents, myGroupCards,
    totalPages, activePage, setActivePage, passivePage, setPassivePage,
    studentPanel, setStudentPanel,
    toggleStudentSelection, handleSelectAll,
    studentGender, setStudentGender, tempStudentBranch, setTempStudentBranch
  } = useManagement(setHeaderTitle);

  useEffect(() => {
    if (!isFormOpen || !editingGroupId) return;
    const t1 = setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    const t2 = setTimeout(() => {
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isFormOpen]);

  const currentPage = studentPanel === 'active' ? activePage : passivePage;
  const setCurrentPage = studentPanel === 'active' ? setActivePage : setPassivePage;

  return (
    <div className="w-full font-inter select-none pb-20 relative">
      <style jsx global>{`
        @keyframes fast-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
        .animate-shake-fast { animation: fast-shake 0.25s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>

      {/* --- BİLDİRİM TOAST --- */}
      {toast.show && (
        <div className="fixed top-12 right-12 z-[200] animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white border border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[20px] p-5 flex items-center gap-4 min-w-[320px]">
            <div className="w-10 h-10 rounded-full bg-status-success-50 flex items-center justify-center text-status-success-500"><CheckCircle2 size={24} /></div>
            <div><p className="text-[14px] font-bold text-base-primary-900 leading-none mb-1">İşlem başarılı</p><p className="text-[13px] font-medium text-neutral-500 leading-none">{toast.message}</p></div>
            <button onClick={() => setToast({ show: false, message: "" })} className="ml-auto p-1.5 text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* --- GRUP YÖNETİMİ --- */}
      <div className="max-w-480 mx-auto px-8 mt-12">

        {/* AKSİYON SATIRI */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-300">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 shrink-0">
              <LayoutGrid size={17} className="text-base-primary-900" />
              <h2 className="text-[16px] font-bold text-base-primary-900 tracking-tight">Grup Yönetimi</h2>
            </div>
            <button
              onClick={handleOpenForm}
              disabled={currentView !== "Aktif Sınıflar" || isFormOpen || !!editingGroupId}
              className={`w-36 h-10 text-white rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer ${currentView === "Aktif Sınıflar" && !isFormOpen && !editingGroupId ? "bg-[#FF8D28] shadow-orange-500/10" : "bg-neutral-300 shadow-none opacity-50 cursor-not-allowed pointer-events-none"}`}
            >
              <span>Grup ekle</span>
              <Plus size={14} strokeWidth={3} />
            </button>
            <p className="text-[13px] text-neutral-400 font-medium border-l border-neutral-200 pl-6 h-6 flex items-center leading-none">
              {currentView !== "Aktif Sınıflar" && !editingGroupId ? "Yeni sınıf eklemek için aktif sınıflar sekmesine geçin." : editingGroupId ? "Mevcut sınıf bilgilerini güncelleyin." : "Yeni bir eğitim sınıfı veya grubu oluşturun."}
            </p>
          </div>
          <div className="flex items-center gap-6 pr-4">
            <div className="text-right hidden md:block">
              <p className="text-[11px] font-semibold text-neutral-400 leading-none mb-1.5 tracking-wider uppercase">Sistem durumu</p>
              <p className="text-[14px] font-bold text-neutral-700 leading-none">{groups.filter(g => g.status === 'active').length} Sınıf / {groups.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.students, 0)} Öğrenci</p>
            </div>
            <button className="w-10 h-10 rounded-lg bg-surface-50 border border-surface-100 flex items-center justify-center text-neutral-400 hover:text-base-primary-500 transition-colors cursor-pointer outline-none"><Info size={18} /></button>
          </div>
        </div>

        {/* FORM ALANI */}
        <div ref={formRef}>
          <GroupForm
            isAdmin={isAdmin}
            isFormOpen={isFormOpen}
            groupCode={groupCode}
            setGroupCode={setGroupCode}
            groupBranch={groupBranch}
            setGroupBranch={setGroupBranch}
            groupModule={groupModule}
            setGroupModule={setGroupModule}
            instructors={instructors}
            selectedInstructorId={selectedInstructorId}
            setSelectedInstructorId={setSelectedInstructorId}
            errors={errors}
            setErrors={setErrors}
            selectedSchedule={selectedSchedule}
            setSelectedSchedule={setSelectedSchedule}
            isScheduleOpen={isScheduleOpen}
            setIsScheduleOpen={setIsScheduleOpen}
            schedules={schedules}
            customSchedule={customSchedule}
            setCustomSchedule={setCustomSchedule}
            handleCancel={handleCancel}
            handleSave={handleSave}
            scheduleRef={scheduleRef}
          />

          {/* Modül değişiklik engel modalı */}
          {moduleBlockModal?.isOpen && (
            <div className="fixed inset-0 z-600 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-base-primary-900/40 backdrop-blur-md" onClick={() => setModuleBlockModal(null)} />
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
                <div className="w-12 h-12 rounded-2xl bg-status-warning-50 border border-status-warning-200 flex items-center justify-center mb-5">
                  <Info size={22} className="text-status-warning-500" />
                </div>
                <h3 className="text-[18px] font-bold text-base-primary-900 mb-2">Modül Değiştirilemez</h3>
                <p className="text-[13px] text-surface-500 mb-2">
                  <strong>{moduleBlockModal.currentModule === "GRAFIK_1" ? "Grafik 1" : "Grafik 2"}</strong> modülü henüz sertifikasyon bölümünden bitirilmemiş.
                </p>
                <p className="text-[13px] text-surface-500 mb-6">
                  Modülü değiştirebilmek için önce{" "}
                  <strong>Not Girişi → Sertifikasyon</strong> sekmesine giderek ilgili grubu seçin ve <strong>&quot;{moduleBlockModal.currentModule === "GRAFIK_1" ? "Grafik 1" : "Grafik 2"} Bitir&quot;</strong> butonuna basın.
                </p>
                <button
                  onClick={() => setModuleBlockModal(null)}
                  className="w-full h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer"
                >
                  Anladım
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GÖRÜNÜM SEKMELERİ + KARTLAR */}
        <div className="mt-6">
          <div className="mb-8">
            <div className="flex items-center bg-surface-50 w-fit p-1 rounded-xl border border-neutral-100 shadow-sm">
              {(["Aktif Sınıflar", isAdmin && "Tüm Sınıflar", "Arşiv"] as (string | false)[]).filter(Boolean).map((t) => (
                <button
                  key={t as string}
                  onClick={() => setCurrentView(t as string)}
                  className={`px-5 py-1.5 rounded-[10px] text-[13px] font-semibold transition-all cursor-pointer outline-none select-none ${currentView === t ? "bg-white text-base-primary-900 shadow-sm border border-neutral-100" : "text-neutral-400 hover:text-neutral-600 border border-transparent"}`}
                >
                  {t as string}
                </button>
              ))}
            </div>
          </div>
          <GroupCards
            currentView={currentView}
            filteredGroups={currentView === "Arşiv" ? filteredArchiveGroups : currentView === "Tüm Sınıflar" ? filteredGroups : myGroupCards}
            selectedGroupId={selectedGroupId}
            setSelectedGroupId={setSelectedGroupId}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            handleEdit={handleEdit}
            requestModal={requestModal}
            onBulkDeleteArchive={requestBulkDeleteArchive}
            handleOpenForm={handleOpenForm}
            menuRef={menuRef}
          />
        </div>

        {/* ÖĞRENCİ BÖLÜMÜ */}
        {currentView === "Aktif Sınıflar" && (
          <div className="mt-16 animate-in fade-in duration-500">

            {/* ROW 1: BAŞLIK + AKTİF/MEZUN TOGGLE + ÖĞRENCI EKLE */}
            <div className="flex items-center justify-between pb-5 border-b border-neutral-200">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <Users size={17} className="text-base-primary-900 shrink-0" />
                  <h2 className="text-[16px] font-bold text-base-primary-900 tracking-tight">Öğrenci Yönetimi</h2>
                  <span className="text-[12px] font-medium text-neutral-400">({filteredStudents.length} Kayıt)</span>
                </div>
                <div className="flex items-center bg-surface-50 p-1 rounded-lg border border-neutral-100 shadow-sm shrink-0">
                  <button
                    onClick={() => setStudentPanel('active')}
                    className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${studentPanel === 'active' ? 'bg-white text-base-primary-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                  >
                    Aktif Öğrenciler
                  </button>
                  <button
                    onClick={() => setStudentPanel('passive')}
                    className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${studentPanel === 'passive' ? 'bg-white text-base-primary-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                  >
                    Mezun Öğrenciler
                  </button>
                </div>
              </div>

              <button
                onClick={() => { if (!isStudentFormOpen) resetStudentForm(); setIsStudentFormOpen(!isStudentFormOpen); }}
                disabled={studentPanel === 'passive'}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[13px] font-semibold transition-all outline-none shadow-sm shrink-0 ${studentPanel === 'passive' ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : isStudentFormOpen ? 'bg-neutral-600 text-white cursor-pointer' : 'bg-designstudio-secondary-500 text-white cursor-pointer'}`}
              >
                {isStudentFormOpen && studentPanel === 'active' ? <X size={15} strokeWidth={2.5} /> : <PlusCircle size={15} strokeWidth={2.5} />}
                <span className="leading-none whitespace-nowrap">{isStudentFormOpen && studentPanel === 'active' ? "Vazgeç" : "Öğrenci Ekle"}</span>
              </button>
            </div>

            {/* ROW 2: FİLTRE SEKMELERİ + SEARCH (24px üst boşluk) */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-surface-50 p-1 rounded-lg border border-neutral-100 shadow-sm shrink-0">
                  <button onClick={() => setViewMode("group-list")} className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${viewMode === "group-list" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>
                    Mevcut Sınıf
                  </button>
                  <button onClick={() => setViewMode("all-groups")} className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${viewMode === "all-groups" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>
                    Sınıflarım
                  </button>
                  {isAdmin && (
                    <button onClick={() => { setViewMode("all-branches"); setStudentBranch("Tümü"); }} className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${viewMode === "all-branches" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>
                      Tüm Şubeler
                    </button>
                  )}
                </div>
                {isAdmin && viewMode === "all-branches" && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="h-5 w-px bg-neutral-200" />
                    <select value={studentBranch} onChange={(e) => setStudentBranch(e.target.value)} className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-base-primary-900 outline-none shadow-sm cursor-pointer">
                      <option value="Tümü">Tümü</option>
                      <option value="Kadıköy">Kadıköy</option>
                      <option value="Şirinevler">Şirinevler</option>
                      <option value="Pendik">Pendik</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="relative w-60 xl:w-72 shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={studentPanel === 'passive'}
                  placeholder="Öğrenci ara..."
                  className={`w-full h-9 bg-white border border-neutral-200 rounded-xl px-4 pr-9 text-[13px] font-medium focus:border-designstudio-secondary-500 transition-all outline-none ${studentPanel === 'passive' ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* ÖĞRENCİ FORM MODALİ */}
            <div className={`fixed inset-0 z-[600] flex items-center justify-center p-6 ${isStudentFormOpen ? "visible" : "invisible pointer-events-none"}`}>
              <div className={`absolute inset-0 bg-[#10294C]/40 backdrop-blur-md transition-opacity duration-500 ${isStudentFormOpen ? "opacity-100" : "opacity-0"}`} onClick={() => setIsStudentFormOpen(false)} />
              <div className={`relative w-full max-w-5xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transform ${isStudentFormOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}>
                <StudentForm
                  isStudentFormOpen={isStudentFormOpen}
                  groups={isAdmin ? groups : myGroupCards}
                  students={students}
                  handleAddStudent={handleAddStudent}
                  setIsStudentFormOpen={setIsStudentFormOpen}
                  editingStudent={editingStudent}
                  avatarId={avatarId}
                  setAvatarId={setAvatarId}
                  studentName={studentName}
                  setStudentName={setStudentName}
                  studentLastName={studentLastName}
                  setStudentLastName={setStudentLastName}
                  studentEmail={studentEmail}
                  setStudentEmail={setStudentEmail}
                  studentNote={studentNote}
                  setStudentNote={setStudentNote}
                  studentBranch={tempStudentBranch}
                  setStudentBranch={setTempStudentBranch}
                  studentGender={studentGender}
                  setStudentGender={setStudentGender}
                  selectedGroupIdForStudent={selectedGroupIdForStudent}
                  setSelectedGroupIdForStudent={setSelectedGroupIdForStudent}
                  selectedGroupId={selectedGroupId}
                />
              </div>
            </div>

            {/* TABLO */}
            <div className="w-full overflow-hidden">
              <StudentTable
                students={pagedStudents}
                selectedStudentIds={selectedStudentIds}
                viewMode={viewMode}
                groups={groups}
                studentPanel={studentPanel}
                isAdmin={!!isAdmin}
                toggleStudentSelection={toggleStudentSelection}
                handleSelectAll={handleSelectAll}
                handleEditStudent={handleEditStudent}
                handleRestoreStudent={handleRestoreStudent}
                handleGraduateStudent={handleGraduateStudent}
                setDeleteModal={setDeleteModal}
              />
              {filteredStudents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                  <Users size={36} className="mb-3 opacity-10" />
                  <p className="text-[13px] font-medium">
                    {studentPanel === 'passive' ? "Mezun öğrenci bulunamadı." : "Kayıtlı öğrenci bulunamadı."}
                  </p>
                </div>
              )}
            </div>

            {/* PAGİNATİON */}
            {viewMode !== 'group-list' && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 mb-2 px-1">
                <p className="text-[12px] font-medium text-neutral-400">
                  {filteredStudents.length} kayıttan {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, filteredStudents.length)} gösteriliyor
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, []).map((p, i) => (
                    typeof p === 'string' ? (
                      <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[12px] text-neutral-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${currentPage === p ? 'bg-base-primary-700 text-white shadow-sm' : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                      >
                        {p}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODALLAR */}
      <GlobalConfirmationModal isOpen={modalConfig.isOpen} type={modalConfig.type as any} count={modalConfig.groupIds?.length} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} onConfirm={confirmModalAction} />
      <StudentDeleteModal
        isOpen={deleteModal.isOpen}
        type={deleteModal.deleteType === 'graduate' ? 'graduate' : 'delete'}
        onClose={() => setDeleteModal({ isOpen: false, studentId: "", deleteType: 'active' })}
        onConfirm={async () => {
          if (deleteModal.deleteType === 'graduate') {
            await handleGraduateStudent(deleteModal.studentId);
          } else if (deleteModal.deleteType === 'graduated') {
            await handleDeleteGraduatedStudent(deleteModal.studentId);
          } else if (deleteModal.studentId === "bulk") {
            await handleBulkDeleteStudents();
          } else {
            await handleDeleteStudent(deleteModal.studentId);
          }
          setDeleteModal({ isOpen: false, studentId: "", deleteType: 'active' });
        }}
      />
    </div>
  );
}

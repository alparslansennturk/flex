"use client";
import React from "react";
import { 
  Plus, Info, X, Users, PlusCircle, Search, CheckCircle2 
} from "lucide-react";

// Dışarı aldığımız bileşenler ve Hook
import { GlobalConfirmationModal, StudentDeleteModal } from "./management-components/Modals";
import { StudentTable } from "./management-components/StudentTable";
import { GroupCards } from "./management-components/GroupCards";
import { GroupForm } from "./management-components/GroupForm";
import { StudentForm } from "./management-components/StudentForm";
import { useManagement } from "@/app/hooks/useManagement";

export default function ManagementContent({ setHeaderTitle }: { setHeaderTitle: (t: string) => void }) {
  
  // TÜM BEYİN (Logic) BURADAN GELİYOR
  const {
    isAdmin, activeSubTab, setActiveSubTab, currentView, setCurrentView,
    isFormOpen, setIsFormOpen, deleteModal, setDeleteModal, showPassive, setShowPassive,
    selectedStudentIds, setSelectedStudentIds, students, groups,
    selectedGroupId, setSelectedGroupId, openMenuId, setOpenMenuId,
    editingGroupId, setEditingGroupId, groupCode, setGroupCode,
    selectedSchedule, setSelectedSchedule, customSchedule, setCustomSchedule,
    isScheduleOpen, setIsScheduleOpen, errors, setErrors, isShaking, setIsShaking,
    searchQuery, setSearchQuery, isStudentFormOpen, setIsStudentFormOpen,
    studentName, setStudentName, studentLastName, setStudentLastName,
    studentEmail, setStudentEmail, studentNote, setStudentNote,
    studentBranch, setStudentBranch, studentError, setStudentError,
    viewMode, setViewMode, toast, setToast, selectedGroupIdForStudent, setSelectedGroupIdForStudent,
    modalConfig, setModalConfig, isProcessing, scheduleRef, menuRef, schedules,
    handleOpenForm, handleCancel, handleSave, handleEdit, requestModal, confirmModalAction,
    handleAddStudent, handleDeleteStudent, handleBulkDeleteStudents, handleEditStudent, resetStudentForm,
    filteredGroups, filteredStudents, toggleStudentSelection, handleSelectAll
  } = useManagement(setHeaderTitle);

  // --- TASARIM (RETURN) BAŞLIYOR ---
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

      {/* --- BÖLÜM 1: NAVİGASYON --- */}
      <div className="w-full mt-6">
        <div className="max-w-[1920px] mx-auto px-8">
          <div className="border-b border-surface-200 flex items-center justify-between h-20 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
            <nav className="flex items-center h-full">
              {["Profil Ayarları", "Kullanıcılar", "Eğitim Yönetimi", "Header & Footer", "Sidebar"].map((label) => {
                const currentId = label === "Eğitim Yönetimi" ? "groups" : label.toLowerCase().replace(" ", "-");
                return (
                  <button key={label} onClick={() => setActiveSubTab(currentId)} className="relative h-full flex items-center px-8 first:pl-0 cursor-pointer outline-none group transition-colors">
                    <span className={`text-[15px] font-semibold tracking-tight whitespace-nowrap ${activeSubTab === currentId ? "text-base-primary-500" : "text-text-tertiary hover:text-text-secondary"}`}>{label}</span>
                    {activeSubTab === currentId && <div className="absolute bottom-0 left-0 w-full h-[3.2px] bg-base-primary-500 rounded-t-full" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {activeSubTab === 'groups' && (
        <div className="max-w-[1920px] mx-auto px-8 mt-[48px]">
          {/* --- BÖLÜM 2: AKSİYON SATIRI --- */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-300 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
            <div className="flex items-center gap-6">
              <button onClick={handleOpenForm} disabled={currentView !== "Aktif Sınıflar" && !editingGroupId} className={`w-[144px] h-[40px] text-white rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer ${currentView === "Aktif Sınıflar" || editingGroupId ? "bg-[#FF8D28] shadow-orange-500/10" : "bg-neutral-300 shadow-none opacity-50 cursor-not-allowed pointer-events-none"}`}><span>{isFormOpen ? "Vazgeç" : (editingGroupId ? "Düzenle" : "Grup ekle")}</span>{isFormOpen ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}</button>
              <p className="text-[14px] text-neutral-400 font-medium border-l border-neutral-200 pl-6 h-6 flex items-center leading-none">{currentView !== "Aktif Sınıflar" && !editingGroupId ? "Yeni grup eklemek için aktif sınıflar sekmesine geçin." : (editingGroupId ? "Mevcut grup bilgilerini güncelleyin." : "Yeni bir eğitim grubu veya sınıf oluşturun.")}</p>
            </div>
            <div className="flex items-center gap-6 pr-4">
              <div className="text-right hidden md:block"><p className="text-[11px] font-bold text-neutral-400 leading-none mb-1.5 tracking-wider">Sistem durumu</p><p className="text-[14px] font-bold text-neutral-700 leading-none">{groups.filter(g => g.status === 'active').length} Grup / {groups.filter(g => g.status === 'active').reduce((acc, curr) => acc + curr.students, 0)} Öğrenci</p></div>
              <button className="w-10 h-10 rounded-lg bg-surface-50 border border-surface-100 flex items-center justify-center text-neutral-400 hover:text-base-primary-500 transition-colors cursor-pointer outline-none"><Info size={18} /></button>
            </div>
          </div>

          {/* --- BÖLÜM 3: FORM ALANI --- */}
          <GroupForm
            isFormOpen={isFormOpen}
            isShaking={isShaking}
            groupCode={groupCode}
            setGroupCode={setGroupCode}
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

          {/* --- BÖLÜM 4: İÇERİK --- */}
          <div className="mt-6">
            <div className="flex items-center bg-surface-50 w-fit p-1 rounded-[14px] mb-8 px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14">
              {["Aktif Sınıflar", isAdmin && "Tüm Sınıflar", "Arşiv"].filter(Boolean).map((t) => (
                <button
                  key={t as string}
                  onClick={() => setCurrentView(t as string)}
                  className={`px-6 py-2 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${currentView === t ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}
                >
                  {t as string}
                </button>
              ))}
            </div>

            <GroupCards
              currentView={currentView}
              filteredGroups={filteredGroups}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              handleEdit={handleEdit}
              requestModal={requestModal}
              handleOpenForm={handleOpenForm}
              menuRef={menuRef}
            />
          </div>

          {/* --- BÖLÜM 5: ÖĞRENCİ LİSTESİ --- */}
          {currentView === "Aktif Sınıflar" && (
            <div className="mt-[64px] px-4 md:px-5 lg:px-3 xl:px-4 2xl:px-14 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center pb-4 border-b border-neutral-200 mb-4">
                <div className="flex items-center gap-2 min-w-fit">
                  <Users size={18} className="text-base-primary-900" />
                  <h2 className="text-[18px] font-bold text-base-primary-900 leading-none tracking-tight">Öğrenciler</h2>
                  <span className="text-[13px] font-medium text-neutral-400 ml-2">({filteredStudents.length} Kayıt)</span>
                </div>

                <div className="flex items-center ml-14 bg-surface-50 p-1 rounded-lg border border-neutral-100 shadow-sm">
                  <button onClick={() => setViewMode("group-list")} className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "group-list" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>Grup Listesi</button>
                  <button onClick={() => setViewMode("all-groups")} className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "all-groups" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>Tüm Gruplarım</button>
                  {isAdmin && (
                    <button onClick={() => setViewMode("all-branches")} className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${viewMode === "all-branches" ? "bg-white text-base-primary-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>Tüm Şubeler</button>
                  )}
                </div>

                {isAdmin && viewMode === "all-branches" && (
                  <div className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4">
                    <div className="h-6 w-px bg-neutral-200 mx-2" />
                    <select value={studentBranch} onChange={(e) => setStudentBranch(e.target.value)} className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-[13px] font-bold text-base-primary-900 outline-none cursor-pointer shadow-sm">
                      <option value="Tümü">Tümü</option>
                      <option value="Kadıköy">Kadıköy</option>
                      <option value="Şirinevler">Şirinevler</option>
                      <option value="Pendik">Pendik</option>
                    </select>
                  </div>
                )}

                <button onClick={() => setIsStudentFormOpen(!isStudentFormOpen)} className="flex items-center gap-2 ml-8 text-base-primary-500 hover:text-base-primary-600 transition-colors group outline-none">
                  {isStudentFormOpen ? <X size={20} /> : <PlusCircle size={20} className="transition-transform group-hover:scale-110" />}
                  <span className="text-[14px] font-bold">{isStudentFormOpen ? "Vazgeç" : "Öğrenci Ekle"}</span>
                </button>

                <div className="relative ml-auto w-[320px]">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="İsim veya soyisim ile ara..." className="w-full h-[40px] bg-white border border-neutral-200 rounded-lg px-4 pr-10 text-[13px] font-medium focus:border-base-primary-500 transition-all shadow-sm outline-none" />
                  <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                </div>
              </div>

              <StudentForm
                isStudentFormOpen={isStudentFormOpen}
                studentBranch={studentBranch}
                setStudentBranch={setStudentBranch}
                selectedGroupIdForStudent={selectedGroupIdForStudent}
                setSelectedGroupIdForStudent={setSelectedGroupIdForStudent}
                groups={groups}
                studentName={studentName}
                setStudentName={setStudentName}
                studentLastName={studentLastName}
                setStudentLastName={setStudentLastName}
                studentEmail={studentEmail}
                setStudentEmail={setStudentEmail}
                studentNote={studentNote}
                setStudentNote={setStudentNote}
                studentError={studentError}
                setStudentError={setStudentError}
                handleAddStudent={handleAddStudent}
                setIsStudentFormOpen={setIsStudentFormOpen}
              />

              <StudentTable
                students={filteredStudents}
                selectedStudentIds={selectedStudentIds}
                viewMode={viewMode}
                groups={groups}
                toggleStudentSelection={toggleStudentSelection}
                handleSelectAll={handleSelectAll}
                handleEditStudent={handleEditStudent}
                setDeleteModal={setDeleteModal}
              />
            </div>
          )}
        </div>
      )}

      <GlobalConfirmationModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type as any}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={confirmModalAction}
      />

      <StudentDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, studentId: "" })}
        onConfirm={async () => {
          if (deleteModal.studentId === "bulk") {
            await handleBulkDeleteStudents();
          } else {
            await handleDeleteStudent(deleteModal.studentId);
          }
          setDeleteModal({ isOpen: false, studentId: "" });
        }}
      />
    </div>
  );
}
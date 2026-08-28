import React, { useState } from 'react';
import {
  ThawingItem,
  FabricationSegment,
  ClosingPlanRecord,
  UserAccount,
  Store,
  StockAdjustment
} from '../types';
import {
  CheckSquare,
  Scale,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Image as ImageIcon,
  Save,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

interface ButcherClosingViewProps {
  currentUser: UserAccount;
  currentStore?: Store;
  items: ThawingItem[];
  segments: FabricationSegment[];
  adjustments?: StockAdjustment[];
  closingRecords?: ClosingPlanRecord[];
  existingClosingRecords?: ClosingPlanRecord[];
  onSaveClosingRecord: (record: Omit<ClosingPlanRecord, 'id' | 'timestamp'>) => void;
}

export default function ButcherClosingView({
  currentUser,
  currentStore,
  items,
  segments,
  adjustments = [],
  closingRecords = [],
  existingClosingRecords,
  onSaveClosingRecord,
}: ButcherClosingViewProps) {
  const records = existingClosingRecords && existingClosingRecords.length > 0 ? existingClosingRecords : closingRecords;
  // Standard Rencana Potong list
  const STANDARD_PLANS = [
    { name: 'D.sapi pot. rdang', category: 'DAGING FRESH', icon: '🥩' },
    { name: 'Daging Rendang Shankle', category: 'SHANKLE', icon: '🥩' },
    { name: 'D Premium lokal', category: 'DAGING PREMIUM', icon: '🍖' },
    { name: 'Rawon Curah', category: 'RAWON', icon: '🥘' },
    { name: 'D.r. fresh member', category: 'DAGING FRESH', icon: '🥩' },
    { name: 'FRIBOY / Daging Prem 2', category: 'DAGING PREMIUM', icon: '🍖' },
  ];

  // Also include any dynamically added plans from items
  const allUniquePlans = [...STANDARD_PLANS];
  items.forEach((item) => {
    if (item.plannedFabrication && !allUniquePlans.some((p) => p.name.toLowerCase() === item.plannedFabrication.toLowerCase())) {
      allUniquePlans.push({
        name: item.plannedFabrication,
        category: (item.pabrikasiCategory || 'DAGING FRESH') as string,
        icon: '🥩',
      });
    }
  });

  // Modal State for Closing specific plan
  const [selectedPlan, setSelectedPlan] = useState<typeof STANDARD_PLANS[0] | null>(null);
  const [physicalWeight, setPhysicalWeight] = useState('');
  const [closingPhoto, setClosingPhoto] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle opening modal for a plan
  const handleOpenClosingModal = (planObj: typeof STANDARD_PLANS[0]) => {
    const safePlanName = (planObj.name || '').toLowerCase();
    const existingRec = records.find(
      (r) => (r.planName || '').toLowerCase() === safePlanName
    );

    setSelectedPlan(planObj);
    setPhysicalWeight(existingRec ? existingRec.actualClosingStockKg.toString() : '');
    setClosingPhoto(existingRec?.photoUrl || '');
    setClosingNote(existingRec?.note || '');
    setErrorMsg('');
  };

  // Handle Photo File Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setClosingPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Submit Closing
  const handleSubmitClosing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const actualStock = parseFloat(physicalWeight);
    if (isNaN(actualStock) || actualStock < 0) {
      setErrorMsg('Harap masukkan angka timbangan sisa stok fisik closing yang valid (≥ 0)!');
      return;
    }

    // MANDATORY PHOTO VALIDATION
    if (!closingPhoto) {
      setErrorMsg('⚠️ FOTO TIMBANGAN FISIK SISA STOK WAJIB DIUNGGAH (MANDATORY)!');
      return;
    }

    // Retrieve sales for this plan from segments or existing record
    const safeSelectedPlanName = (selectedPlan.name || '').toLowerCase();
    const existingRec = records.find(
      (r) => (r.planName || '').toLowerCase() === safeSelectedPlanName
    );
    const planSegments = segments.filter(
      (s) => (s.plannedFabrication || '').toLowerCase().includes(safeSelectedPlanName)
    );
    const calculatedSales = planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
    const salesVal = existingRec ? existingRec.salesKg : calculatedSales;

    // Filter items processed today vs carryover
    const todayPlanItems = items.filter(
      (i) => !i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelectedPlanName)
    );
    const carryoverPlanItems = items.filter(
      (i) => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelectedPlanName)
    );

    // Adjustments for this plan
    const planAdj = adjustments.filter(
      (a) => (a.planName || '').toLowerCase().includes(safeSelectedPlanName)
    );
    const adjIn = planAdj.filter((a) => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
    const adjOut = planAdj.filter((a) => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);

    const openingStockKg = carryoverPlanItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const newProcessedKg = todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
    const totalTersedia = openingStockKg + newProcessedKg + adjIn - adjOut;
    const closingBySystem = Math.max(0, totalTersedia - salesVal);
    const susutJualKg = Math.max(0, closingBySystem - actualStock);

    onSaveClosingRecord({
      storeId: currentUser.storeId || 'store_ckr',
      date: new Date().toISOString().split('T')[0],
      planName: selectedPlan.name,
      category: selectedPlan.category,
      openingStockKg: parseFloat(openingStockKg.toFixed(3)),
      newProcessedKg: parseFloat(newProcessedKg.toFixed(3)),
      adjustInKg: parseFloat(adjIn.toFixed(3)),
      adjustOutKg: parseFloat(adjOut.toFixed(3)),
      salesKg: parseFloat(salesVal.toFixed(3)),
      closingStockBySystemKg: parseFloat(closingBySystem.toFixed(3)),
      actualClosingStockKg: parseFloat(actualStock.toFixed(3)),
      susutJualKg: parseFloat(susutJualKg.toFixed(3)),
      photoUrl: closingPhoto,
      photoCaption: `Foto Timbangan Closing: ${selectedPlan.name}`,
      note: closingNote.trim(),
      butcherName: currentUser.fullName,
    });

    setSuccessMsg(`Closing fisik untuk "${selectedPlan.name}" berhasil disimpan!`);
    setTimeout(() => setSuccessMsg(''), 4000);
    setSelectedPlan(null);
  };

  return (
    <div className="space-y-6">
      {/* Title & Instructions Header */}
      <div className="bg-gradient-to-r from-red-900 via-red-800 to-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-700/80 text-red-100 border border-red-500/30">
              Menu Closing Butcher
            </span>
            <span className="text-xs text-red-200">
              {currentStore?.name || 'TDN Cikarang Utara'}
            </span>
          </div>
          <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-red-300" />
            Closing Fisik Per Rencana Potong
          </h1>
          <p className="text-xs text-red-200 mt-1">
            Lakukan timbang fisik sisa daging di display/chiller untuk setiap rencana potong. <strong className="text-white">Upload foto bukti timbangan adalah MANDATORY (Wajib).</strong>
          </p>
        </div>

        <div className="bg-red-950/70 border border-red-700/60 p-3 rounded-xl flex items-center gap-3 shrink-0">
          <Camera className="w-5 h-5 text-red-300 animate-pulse" />
          <div className="text-xs">
            <span className="text-slate-300 block font-medium">Status Closing:</span>
            <strong className="text-white font-bold">
              {records.length} dari {allUniquePlans.length} Selesai
            </strong>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-xl flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{successMsg}</span>
        </div>
      )}

      {/* Grid of Rencana Potong Cards (Similar to Antrian Thawing Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allUniquePlans.map((plan) => {
          const safePName = (plan.name || '').toLowerCase();
          const existingRec = records.find(
            (r) => (r.planName || '').toLowerCase() === safePName
          );

          // Get items for this plan
          const todayPlanItems = items.filter(
            (i) => !i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safePName)
          );
          const carryoverPlanItems = items.filter(
            (i) => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safePName)
          );
          const planSegments = segments.filter(
            (s) => (s.plannedFabrication || '').toLowerCase().includes(safePName)
          );

          const openingKg = existingRec
            ? existingRec.openingStockKg
            : carryoverPlanItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
          const processedKg = existingRec
            ? existingRec.newProcessedKg
            : todayPlanItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
          const salesKg = existingRec
            ? existingRec.salesKg
            : planSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);

          return (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                existingRec
                  ? 'border-emerald-300 bg-emerald-50/10'
                  : 'border-slate-200 hover:border-red-400'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                      {plan.category}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                      <span>{plan.icon}</span>
                      <span>{plan.name}</span>
                    </h3>
                  </div>

                  {existingRec ? (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Sudah Closing
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[11px] font-bold flex items-center gap-1 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Belum Closing
                    </span>
                  )}
                </div>

                {/* Metrics Breakdown Box */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Sisa Kemarin</span>
                    <strong className="text-slate-800 font-mono text-xs">{openingKg.toFixed(2)} Kg</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Diolah Baru</span>
                    <strong className="text-red-700 font-mono text-xs">{processedKg.toFixed(2)} Kg</strong>
                  </div>
                </div>

                {/* Sisa Stok Fisik Result (if closed) */}
                {existingRec && (
                  <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-700 font-semibold block">Timbangan Fisik Closing:</span>
                      <span className="text-sm font-black text-emerald-900 font-mono">
                        {existingRec.actualClosingStockKg.toFixed(3)} Kg
                      </span>
                    </div>
                    {existingRec.photoUrl && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-300 shadow-2xs">
                        <img src={existingRec.photoUrl} alt="Foto Closing" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenClosingModal(plan)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    existingRec
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-red-700 hover:bg-red-800 text-white'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>{existingRec ? 'Edit / Perbarui Closing' : 'Timbang & Closing Rencana Ini'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recap Table of Recorded Closings */}
      {records.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-red-700" />
              Rekapitulasi Closing Fisik Butcher Hari Ini ({records.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Data otomatis terhubung ke Admin Toko & MD
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3">Rencana Potong</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Sisa Kemarin (Kg)</th>
                  <th className="p-3 text-right">Bahan Diolah (Kg)</th>
                  <th className="p-3 text-right bg-red-50 font-black text-red-950">Sisa Fisik Real (Kg)</th>
                  <th className="p-3 text-right text-amber-700">Susut Jual (Kg)</th>
                  <th className="p-3 text-center">Foto Bukti</th>
                  <th className="p-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{r.planName}</td>
                    <td className="p-3 text-slate-600">{r.category}</td>
                    <td className="p-3 text-right font-mono">{r.openingStockKg.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono font-semibold">{r.newProcessedKg.toFixed(3)}</td>
                    <td className="p-3 text-right font-mono font-black text-red-950 bg-red-50">
                      {r.actualClosingStockKg.toFixed(3)} Kg
                    </td>
                    <td className="p-3 text-right font-mono text-amber-700 font-semibold">{r.susutJualKg.toFixed(3)}</td>
                    <td className="p-3 text-center">
                      {r.photoUrl ? (
                        <a
                          href={r.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-bold"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> Lihat Foto
                        </a>
                      ) : (
                        <span className="text-red-500 font-bold">Tidak Ada</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700">{r.butcherName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT TIMBANGAN & MANDATORY FOTO CLOSING */}
      {/* ========================================================================= */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-red-900 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-700/60 rounded-xl border border-red-500/40">
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Closing Rencana Potong</h3>
                  <p className="text-xs text-red-200">{selectedPlan.name} ({selectedPlan.category})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="text-red-200 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitClosing} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-bold">{errorMsg}</span>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Petunjuk Butcher:</strong>
                  <p className="text-slate-600 mt-0.5">
                    Timbang seluruh sisa daging untuk rencana <strong>"{selectedPlan.name}"</strong> di chiller/display, lalu upload foto timbangan fisik real sebagai bukti wajib.
                  </p>
                </div>
              </div>

              {/* Live Calculation Preview Card */}
              {(() => {
                const safeSelName = (selectedPlan.name || '').toLowerCase();
                const selectedPlanRec = records.find(r => (r.planName || '').toLowerCase() === safeSelName);
                const selectedPlanTodayItems = items.filter(i => !i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanCarryoverItems = items.filter(i => i.isCarryover && (i.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanSegments = segments.filter(s => (s.plannedFabrication || '').toLowerCase().includes(safeSelName));
                const selectedPlanAdj = adjustments.filter(a => (a.planName || '').toLowerCase().includes(safeSelName));

                const modalOpening = selectedPlanRec ? selectedPlanRec.openingStockKg : selectedPlanCarryoverItems.reduce((sum, i) => sum + i.weightBeforeThawing, 0);
                const modalProcessed = selectedPlanRec ? selectedPlanRec.newProcessedKg : selectedPlanTodayItems.reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);
                const modalAdjIn = selectedPlanAdj.filter(a => a.type === 'IN').reduce((sum, a) => sum + a.weightKg, 0);
                const modalAdjOut = selectedPlanAdj.filter(a => a.type === 'OUT').reduce((sum, a) => sum + a.weightKg, 0);
                const modalTotalTersedia = modalOpening + modalProcessed + modalAdjIn - modalAdjOut;
                const modalSales = selectedPlanRec ? selectedPlanRec.salesKg : selectedPlanSegments.reduce((sum, s) => sum + (s.salesKg || 0), 0);
                const modalStokSistem = Math.max(0, modalTotalTersedia - modalSales);
                const modalInputWeight = parseFloat(physicalWeight) || 0;
                const modalLiveSusut = physicalWeight ? Math.max(0, modalStokSistem - modalInputWeight) : 0;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                      <span>Perhitungan Stok Sistem:</span>
                      <span className="text-blue-900 font-mono font-black">{modalStokSistem.toFixed(3)} Kg</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block">Tersedia:</span>
                        <strong className="text-slate-700 font-mono">{modalTotalTersedia.toFixed(3)} Kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Sales (Jual):</span>
                        <strong className="text-emerald-700 font-mono">{modalSales.toFixed(3)} Kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Stok Sistem:</span>
                        <strong className="text-blue-700 font-mono">{modalStokSistem.toFixed(3)} Kg</strong>
                      </div>
                    </div>

                    {physicalWeight && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-red-900 font-bold text-[11px]">
                          Nilai Susut Otomatis (Sistem - Fisik):
                        </span>
                        <span className="font-mono font-black text-sm text-red-700">
                          {modalLiveSusut.toFixed(3)} Kg
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Timbangan Sisa Stok Fisik */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Timbangan Sisa Stok Fisik Akhir (Kg) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    autoFocus
                    placeholder="Contoh: 136.881"
                    value={physicalWeight}
                    onChange={(e) => setPhysicalWeight(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-red-600 rounded-xl focus:bg-white focus:outline-hidden text-slate-900 text-lg font-black"
                    required
                  />
                  <span className="absolute right-4 top-3 text-slate-400 font-bold text-lg">Kg</span>
                </div>
              </div>

              {/* MANDATORY PHOTO UPLOAD */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-red-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-red-600" />
                    Foto Timbangan Fisik Real (Wajib / MANDATORY) *
                  </label>
                  <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-md border border-red-300">
                    Mandatory
                  </span>
                </div>

                <div className="border-2 border-dashed border-red-300 bg-red-50/40 hover:bg-red-50 rounded-2xl p-4 text-center cursor-pointer transition relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {closingPhoto ? (
                    <div className="space-y-2">
                      <img
                        src={closingPhoto}
                        alt="Bukti Foto Closing"
                        className="h-28 w-auto mx-auto object-cover rounded-xl shadow-sm border border-red-300"
                      />
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Foto Berhasil Dipilih (Ketuk untuk ganti)
                      </span>
                    </div>
                  ) : (
                    <div className="py-3 space-y-1">
                      <Upload className="w-8 h-8 text-red-500 mx-auto mb-1" />
                      <p className="text-xs font-bold text-red-950">
                        Ketuk untuk Ambil Foto Kamera / Unggah File
                      </p>
                      <p className="text-[10px] text-red-700">
                        Foto angka display timbangan atau kondisi sisa daging
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Catatan Butcher */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Catatan Butcher (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Daging sudah diwrap rapi dan disimpan di chiller 2"
                  value={closingNote}
                  onChange={(e) => setClosingNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Closing Rencana</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

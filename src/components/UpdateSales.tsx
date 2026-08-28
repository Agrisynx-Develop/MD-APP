import React, { useState } from 'react';
import { ThawingItem, FabricationSegment } from '../types';
import { ShoppingBag, ShoppingCart, Scale, Save, AlertCircle, Sparkles, CheckCircle2, Layers, RefreshCw, ArrowRightLeft, ShieldCheck } from 'lucide-react';

interface UpdateSalesProps {
  segments: FabricationSegment[];
  items?: ThawingItem[];
  onUpdateSales: (planNameOrSegmentId: string, salesAmountKg: number, overridePhysicalClosingKg?: number) => void;
  onTransferPurpose?: (
    id: string,
    isSegment: boolean,
    targetPurpose: 'UNTUK PESANAN' | 'UNTUK DISPLAY',
    transferWeightKg?: number
  ) => void;
  onOpenTransferModal?: () => void;
}

interface PlanSalesGroup {
  planName: string;
  stockAwalKg: number; // Opening Stock
  totalSalesKg: number; // Accumulation of sales
  totalShrinkageKg: number; // Accumulation of shrinkage
  stockClosingKg: number; // System ending stock (actualWeight)
  segmentCount: number;
}

export default function UpdateSales({
  segments,
  items = [],
  onUpdateSales,
  onTransferPurpose,
  onOpenTransferModal,
}: UpdateSalesProps) {
  const [selectedPlanName, setSelectedPlanName] = useState('');
  const [salesInput, setSalesInput] = useState('');
  const [physicalClosingInput, setPhysicalClosingInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Default standard fabrication cut plans
  const DEFAULT_PLANS = [
    'D.sapi pot. rdang',
    'Daging Rendang Shankle',
    'D Premium lokal',
    'Rawon Curah',
    'D.r. fresh member',
    'FRIBOY / Daging Prem 2',
  ];

  // Extract unique cut plans from standard plans, items, and segments
  const existingPlanNames = Array.from(
    new Set([
      ...DEFAULT_PLANS,
      ...items.map((i) => i.plannedFabrication).filter(Boolean) as string[],
      ...segments.map((seg) => {
        const parentItem = items.find((i) => i.id === seg.itemId);
        return seg.plannedFabrication || parentItem?.plannedFabrication || '';
      }).filter(Boolean),
    ])
  );

  // Group metrics per plan
  const planSalesGroups: PlanSalesGroup[] = existingPlanNames.map((plan) => {
    const itemsForPlan = items.filter(
      (i) => (i.plannedFabrication || '').toLowerCase() === plan.toLowerCase()
    );
    const segsForPlan = segments.filter((seg) => {
      const parentItem = items.find((i) => i.id === seg.itemId);
      const segPlan = seg.plannedFabrication || parentItem?.plannedFabrication || '';
      return segPlan.toLowerCase() === plan.toLowerCase();
    });

    const carryoverKg = itemsForPlan
      .filter((i) => i.isCarryover)
      .reduce((sum, i) => sum + i.weightBeforeThawing, 0);
    const todayProcessedKg = itemsForPlan
      .filter((i) => !i.isCarryover)
      .reduce((sum, i) => sum + (i.weightAfterThawing || i.weightBeforeThawing), 0);

    const totalSalesFromSegs = segsForPlan.reduce((acc, seg) => acc + (seg.salesKg || 0), 0);
    const totalSalesFromItems = itemsForPlan.reduce((acc, i) => acc + (i.salesKg || 0), 0);
    const totalSales = totalSalesFromSegs > 0 ? totalSalesFromSegs : totalSalesFromItems;

    const totalShrinkFromSegs = segsForPlan.reduce((acc, seg) => acc + (seg.periodicShrinkage || 0), 0);
    const totalShrinkFromItems = itemsForPlan.reduce((acc, i) => acc + (i.susutJualKg || 0), 0);
    const totalShrink = totalShrinkFromSegs > 0 ? totalShrinkFromSegs : totalShrinkFromItems;

    const segsStock = segsForPlan.reduce((acc, seg) => acc + (seg.actualWeight || 0), 0);
    const hasSegs = segsForPlan.length > 0;

    const rawOpening = carryoverKg + todayProcessedKg;
    const stockAwal = hasSegs
      ? Math.max(rawOpening, segsForPlan.reduce((acc, s) => acc + Math.max(s.targetWeight || 0, (s.actualWeight || 0) + (s.periodicShrinkage || 0) + (s.salesKg || 0)), 0))
      : rawOpening;

    const currentStock = hasSegs
      ? segsStock
      : Math.max(0, stockAwal - totalSales - totalShrink);

    return {
      planName: plan,
      stockAwalKg: stockAwal,
      totalSalesKg: totalSales,
      totalShrinkageKg: totalShrink,
      stockClosingKg: currentStock,
      segmentCount: segsForPlan.length || itemsForPlan.length,
    };
  });

  // Overall Totals
  const overallStockAwal = planSalesGroups.reduce((acc, g) => acc + g.stockAwalKg, 0);
  const overallTotalSales = planSalesGroups.reduce((acc, g) => acc + g.totalSalesKg, 0);
  const overallTotalShrinkage = planSalesGroups.reduce((acc, g) => acc + g.totalShrinkageKg, 0);
  const overallStockClosing = planSalesGroups.reduce((acc, g) => acc + g.stockClosingKg, 0);

  const selectedGroup = planSalesGroups.find((g) => g.planName === selectedPlanName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedPlanName) {
      setErrorMsg('Harap pilih salah satu Rencana Potongan / Pabrikasi!');
      return;
    }

    const salesVal = parseFloat(salesInput);
    const physicalVal = physicalClosingInput ? parseFloat(physicalClosingInput) : undefined;

    if (isNaN(salesVal) || salesVal < 0) {
      setErrorMsg('Harap masukkan jumlah sales angka positif yang valid (0 atau lebih)!');
      return;
    }

    if (selectedGroup && salesVal > selectedGroup.stockClosingKg && !physicalVal) {
      setErrorMsg(
        `Nilai sales (${salesVal.toFixed(2)} Kg) melebihi sisa stok timbangan aktif untuk "${selectedPlanName}" (${selectedGroup.stockClosingKg.toFixed(2)} Kg)!`
      );
      return;
    }

    // Trigger update
    onUpdateSales(selectedPlanName, salesVal, physicalVal);

    // Reset Form
    setSalesInput('');
    setPhysicalClosingInput('');
    setSuccessMsg(
      `Berhasil mengupdate sales sebesar ${salesVal} Kg untuk Rencana Potong "${selectedPlanName}". Stok Closing otomatis disinkronkan!`
    );
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            🛒 Update Jumlah Sales & Stok Closing Daging
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Input penjualan daging harian (POS/Kasir) dan lakukan rekonsiliasi Stok Awal, Sales, Susut, & Stock Closing fisik.
          </p>
        </div>

        {onOpenTransferModal && (
          <button
            type="button"
            onClick={onOpenTransferModal}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto border border-amber-400"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Alihkan Peruntukan (Pesanan ⇆ Display)</span>
          </button>
        )}
      </div>

      {/* Metric Cards Banner */}
      {/* Notice Banner: Sales vs Susut Separation */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 font-extrabold text-sm">
          🛍️ SALES
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-emerald-950">
            Keterangan Kategori: Pengurangan Karena Sales (Penjualan)
          </h4>
          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
            Pengurangan stok akibat transaksi kasir / penjualan dicatat khusus sebagai <strong>Sales (Penjualan)</strong> dan <strong>TIDAK dimasukkan sebagai Susut (Penyusutan Fisik / Penguapan)</strong>. Hal ini untuk memastikan akurasi margin dan pencatatan audit stok yang terpisah dan transparan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stock Awal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            📦 Stock Awal Daging
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {overallStockAwal.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-slate-500">Kg</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            Total berat daging awal dibuka / dipabrikasi
          </p>
        </div>

        {/* Card 2: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-emerald-600" /> Total Sales (Penjualan)
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-emerald-800 tracking-tight">
              {overallTotalSales.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-emerald-600">Kg</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-semibold">
            Akumulasi penjualan tercatat di kasir
          </p>
        </div>

        {/* Card 3: Total Susut */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider block mb-1">
            📉 Total Susut Berkala
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-amber-900 tracking-tight">
              {overallTotalShrinkage.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-amber-600">Kg</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-2 font-medium">
            Penguapan / susut fisik chiller
          </p>
        </div>

        {/* Card 4: Stock Closing */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
          <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-400" /> Stock Closing (Akhir)
          </span>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-white tracking-tight">
              {overallStockClosing.toFixed(2)}
            </h3>
            <span className="text-sm font-bold text-slate-400">Kg</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-2 font-medium">
            Formula: Stock Awal - Sales - Susut
          </p>
        </div>
      </div>

      {/* Main Input Form & Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form Panel (Col-7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Form Update Jumlah Sales Daging</h2>
                <p className="text-xs text-slate-500">Catat jumlah terpotong / terjual untuk potongan daging aktif</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sinkronisasi Stok Aktif
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-100 flex items-start gap-1.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Select Cut Plan */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Pilih Rencana Potong / Pabrikasi *
              </label>
              <select
                value={selectedPlanName}
                onChange={(e) => setSelectedPlanName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm font-bold"
              >
                <option value="">-- Ketuk Untuk Pilih Rencana Potong --</option>
                {planSalesGroups.map((group) => (
                  <option key={group.planName} value={group.planName}>
                    {group.planName} ➔ Awal: {group.stockAwalKg.toFixed(2)} Kg | Sales: {group.totalSalesKg.toFixed(2)} Kg | Closing System: {group.stockClosingKg.toFixed(2)} Kg
                  </option>
                ))}
              </select>
            </div>

            {/* Metrics Breakdown Card for selected plan */}
            {selectedGroup && (
              <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-200 space-y-3 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Detail Rencana:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 text-emerald-900 rounded-lg font-black text-xs">
                    {selectedGroup.planName}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Stock Awal</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {selectedGroup.stockAwalKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 block text-[10px] font-extrabold uppercase">Total Sales</span>
                    <span className="text-sm font-black text-emerald-700 block mt-0.5">
                      {selectedGroup.totalSalesKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-amber-700 block text-[10px] font-extrabold uppercase">Total Susut</span>
                    <span className="text-sm font-black text-amber-800 block mt-0.5">
                      {selectedGroup.totalShrinkageKg.toFixed(2)} Kg
                    </span>
                  </div>
                  <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-2xs">
                    <span className="text-emerald-400 block text-[10px] font-extrabold uppercase">Stock Closing</span>
                    <span className="text-sm font-black text-white block mt-0.5">
                      {selectedGroup.stockClosingKg.toFixed(2)} Kg
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sales Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Jumlah Sales Baru Ditambahkan (Kg) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  placeholder="Contoh: 2.50 (berarti terjual 2.5 kg)"
                  value={salesInput}
                  onChange={(e) => setSalesInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-lg font-bold"
                />
                <span className="absolute right-4 top-3 text-slate-400 font-bold">Kg</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Sistem akan mengurangi Stock Closing (sisa stok aktif) sesuai jumlah penjualan ini.
              </p>
            </div>

            {/* Physical Closing Override Input (Optional Reconciliation) */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Rekonsiliasi Timbangan Closing Fisik (Opsional)</span>
                <span className="text-[10px] text-slate-400 font-normal">(Hasil timbangan fisik sore/malam)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  placeholder="Isi jika ada perbedaan timbangan fisik dengan sistem"
                  value={physicalClosingInput}
                  onChange={(e) => setPhysicalClosingInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 text-slate-900 text-sm font-bold"
                />
                <span className="absolute right-4 top-2.5 text-slate-400 font-bold text-xs">Kg</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
            >
              <Save className="w-5 h-5" />
              Simpan & Update Sales / Closing Stok
            </button>
          </form>
        </div>

        {/* Informative Box (Col-5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="text-emerald-400 w-5 h-5" />
                <h3 className="text-base font-bold text-white">Alur Rekonsiliasi Stok Daging</h3>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">1. Stock Awal (Opening)</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Input Pagi</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Total berat daging dari hasil timbangan thawed / pabrikasi potongan.</p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">2. Penjualan (Sales) vs Susut Chiller</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Kategori Terpisah</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Penjualan (Sales) mengurangi stok sebagai omset kasir, terpisah penuh dari Susut Chiller (penguapan).
                  </p>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold">3. Stock Closing (Ending)</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Malam / Closing</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sisa stok teoretis disinkronkan dengan timbangan fisik display untuk verifikasi tidak ada selisih yang hilang.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sistem menjaga audit trail transparan antara Butcher, Supervisor & Kasir.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Breakdown Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Rincian Rekonsiliasi Per Rencana Potong
            </h3>
            <p className="text-xs text-slate-500">Matriks Stock Awal, Sales, Susut, dan Stock Closing</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Rencana Potongan / Pabrikasi</th>
                <th className="py-3 px-4 text-right">Stock Awal (Kg)</th>
                <th className="py-3 px-4 text-right">
                  Sales / Penjualan (Kg)
                  <span className="block text-[9px] text-emerald-600 font-extrabold uppercase">(Bukan Susut)</span>
                </th>
                <th className="py-3 px-4 text-right">
                  Susut Chiller (Kg)
                  <span className="block text-[9px] text-amber-700 font-extrabold uppercase">(Penguapan Fisik)</span>
                </th>
                <th className="py-3 px-4 text-right">Stock Closing (Kg)</th>
                <th className="py-3 px-4 text-center">Status Stok</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {planSalesGroups.map((group) => {
                const isOutOfStock = group.stockClosingKg <= 0 && group.stockAwalKg > 0;
                return (
                  <tr key={group.planName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{group.planName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {group.stockAwalKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700">
                      {group.totalSalesKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-800">
                      {group.totalShrinkageKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      {group.stockClosingKg.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isOutOfStock ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                          Habis (0 Kg)
                        </span>
                      ) : group.stockClosingKg > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Tersedia
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-400">
                          Belum Ada Stok
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlanName(group.planName);
                          window.scrollTo({ top: 100, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-extrabold rounded-lg text-[11px] transition-all cursor-pointer"
                      >
                        Pilih & Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

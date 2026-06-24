'use client';

import { useState } from 'react';
import { IconX, IconPlus, IconCheck, IconEdit, IconTrash } from '@tabler/icons-react';
import { Position, TradingState, MarginMode, PartialTP } from '@/types/trading';
import { fmt, fmtPrice, effectiveLiquidationPrice, positionPnl, genId } from '@/lib/trading';

interface PositionsListProps {
  positions: Position[];
  prices: Record<string, number>;
  cash: number;
  tradingState: TradingState;
  onClose: (id: string) => void;
  onPartialClose: (id: string, pct: number, exitPrice: number) => void;
  onAddToPosition: (id: string, margin: number, price: number) => void;
  onSwitchMarginMode: (id: string, mode: MarginMode, currentPrice: number) => void;
  onUpdateTpSl: (id: string, tp: number | null, sl: number | null) => void;
  onUpdatePartialTPs: (id: string, partialTPs: PartialTP[]) => void;
}

// ── Fermeture partielle ──────────────────────────────────────────────────────
function ClosePanel({ pos, price, onConfirm, onCancel }: {
  pos: Position; price: number;
  onConfirm: (pct: number) => void; onCancel: () => void;
}) {
  const [pct, setPct] = useState(50);
  const ratio = pct / 100;
  const closedQty = pos.qty * ratio;
  const closedMargin = pos.margin * ratio;
  const priceDiff = pos.side === 'LONG' ? price - pos.entryPrice : pos.entryPrice - price;
  const realizedPnl = priceDiff * closedQty;
  const returned = Math.max(0, closedMargin + realizedPnl);
  const positive = realizedPnl >= 0;

  return (
    <div className="mt-2 rounded-lg border border-border-soft bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-neutral-400">Fermeture partielle</p>
      <div className="mb-2 flex gap-1.5">
        {[25, 50, 75, 100].map((v) => (
          <button key={v} onClick={() => setPct(v)}
            className={`flex-1 rounded border py-1 text-xs ${pct === v
              ? 'border-blue-400 bg-blue-950/30 text-blue-400'
              : 'border-border-soft text-neutral-400 hover:bg-surface-muted'}`}>
            {v}%
          </button>
        ))}
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-neutral-500">
          <span>1%</span><span className="font-medium text-foreground">{pct}%</span><span>100%</span>
        </div>
        <input type="range" min={1} max={100} step={1} value={pct}
          onChange={(e) => setPct(parseInt(e.target.value))}
          className="w-full accent-blue-500" />
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-muted p-2 text-xs">
        <div><p className="text-neutral-500">Qté fermée</p><p className="font-medium">{closedQty.toFixed(6)}</p></div>
        <div><p className="text-neutral-500">PnL réalisé</p>
          <p className={`font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {positive ? '+' : ''}{fmt(realizedPnl)}</p></div>
        <div><p className="text-neutral-500">Retour cash</p><p className="font-medium">{fmt(returned)}</p></div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onConfirm(pct)}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/50 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/30">
          <IconCheck size={13} />Confirmer {pct === 100 ? '(tout)' : `(${pct}%)`}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-neutral-400 hover:bg-surface-muted">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── TP/SL + TP Partiels ──────────────────────────────────────────────────────
function TpSlPanel({ pos, onConfirmTpSl, onConfirmPartialTPs, onCancel }: {
  pos: Position;
  onConfirmTpSl: (tp: number | null, sl: number | null) => void;
  onConfirmPartialTPs: (tps: PartialTP[]) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<'tpsl' | 'partial'>('tpsl');

  // TP/SL tab state
  const [mode, setMode] = useState<'price' | 'pct'>('price');
  const [tpVal, setTpVal] = useState(pos.tp?.toString() ?? '');
  const [slVal, setSlVal] = useState(pos.sl?.toString() ?? '');
  const [tpPct, setTpPct] = useState('');
  const [slPct, setSlPct] = useState('');

  // Partial TPs tab state
  const [partialTPs, setPartialTPs] = useState<PartialTP[]>(
    (pos.partialTPs ?? []).filter(t => !t.triggered)
  );
  const [newPrice, setNewPrice] = useState('');
  const [newPct, setNewPct] = useState('');
  const [newPriceMode, setNewPriceMode] = useState<'price' | 'pct'>('price');
  const [newPctGain, setNewPctGain] = useState('');

  function computeTpSlPrice() {
    if (mode === 'price') {
      return { tp: tpVal ? parseFloat(tpVal) : null, sl: slVal ? parseFloat(slVal) : null };
    }
    const tpP = parseFloat(tpPct);
    const slP = parseFloat(slPct);
    const entry = pos.entryPrice;
    const isLong = pos.side === 'LONG';
    return {
      tp: !isNaN(tpP) && tpP > 0 ? isLong ? entry * (1 + tpP / 100) : entry * (1 - tpP / 100) : null,
      sl: !isNaN(slP) && slP > 0 ? isLong ? entry * (1 - slP / 100) : entry * (1 + slP / 100) : null,
    };
  }

  function computePartialPrice() {
    if (newPriceMode === 'price') return parseFloat(newPrice) || null;
    const pctG = parseFloat(newPctGain);
    if (isNaN(pctG) || pctG <= 0) return null;
    return pos.side === 'LONG'
      ? pos.entryPrice * (1 + pctG / 100)
      : pos.entryPrice * (1 - pctG / 100);
  }

  function addPartialTP() {
    const price = computePartialPrice();
    const pct = parseFloat(newPct);
    if (!price || isNaN(pct) || pct <= 0 || pct > 100) return;
    const totalPct = partialTPs.reduce((s, t) => s + t.pct, 0) + pct;
    if (totalPct > 100) return;
    setPartialTPs([...partialTPs, { id: genId(), price, pct, triggered: false }]);
    setNewPrice(''); setNewPct(''); setNewPctGain('');
  }

  function removePartialTP(id: string) {
    setPartialTPs(partialTPs.filter(t => t.id !== id));
  }

  const preview = computeTpSlPrice();
  const partialPrice = computePartialPrice();
  const totalPct = partialTPs.reduce((s, t) => s + t.pct, 0);
  const isLong = pos.side === 'LONG';

  return (
    <div className="mt-2 rounded-lg border border-border-soft bg-surface p-3">
      {/* Onglets */}
      <div className="mb-3 flex gap-1 rounded-lg bg-surface-muted p-1">
        <button onClick={() => setTab('tpsl')}
          className={`flex-1 rounded py-1 text-xs font-medium ${tab === 'tpsl'
            ? 'bg-surface text-foreground shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
          TP / SL global
        </button>
        <button onClick={() => setTab('partial')}
          className={`flex-1 rounded py-1 text-xs font-medium ${tab === 'partial'
            ? 'bg-surface text-foreground shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
          TP partiels {partialTPs.length > 0 ? `(${partialTPs.length})` : ''}
        </button>
      </div>

      {tab === 'tpsl' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500">Mode de saisie</p>
            <div className="flex gap-1">
              <button onClick={() => setMode('price')}
                className={`rounded px-2 py-0.5 text-xs ${mode === 'price'
                  ? 'bg-blue-950/40 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
                Prix ($)
              </button>
              <button onClick={() => setMode('pct')}
                className={`rounded px-2 py-0.5 text-xs ${mode === 'pct'
                  ? 'bg-blue-950/40 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
                % gain/perte
              </button>
            </div>
          </div>

          {mode === 'price' ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Take profit ($)</label>
                <input type="number" value={tpVal} onChange={(e) => setTpVal(e.target.value)} placeholder="optionnel"
                  className="h-8 w-full rounded border border-border-soft bg-surface-muted px-2 text-xs outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">Stop loss ($)</label>
                <input type="number" value={slVal} onChange={(e) => setSlVal(e.target.value)} placeholder="optionnel"
                  className="h-8 w-full rounded border border-border-soft bg-surface-muted px-2 text-xs outline-none focus:border-red-400" />
              </div>
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">TP +% ({isLong ? 'hausse' : 'baisse'})</label>
                <div className="relative">
                  <input type="number" min={0} value={tpPct} onChange={(e) => setTpPct(e.target.value)} placeholder="ex: 5"
                    className="h-8 w-full rounded border border-border-soft bg-surface-muted px-2 pr-6 text-xs outline-none focus:border-emerald-400" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500">%</span>
                </div>
                {tpPct && preview.tp && <p className="mt-0.5 text-[10px] text-emerald-400">→ {fmtPrice(preview.tp)}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">SL -% ({isLong ? 'baisse' : 'hausse'})</label>
                <div className="relative">
                  <input type="number" min={0} value={slPct} onChange={(e) => setSlPct(e.target.value)} placeholder="ex: 3"
                    className="h-8 w-full rounded border border-border-soft bg-surface-muted px-2 pr-6 text-xs outline-none focus:border-red-400" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500">%</span>
                </div>
                {slPct && preview.sl && <p className="mt-0.5 text-[10px] text-red-400">→ {fmtPrice(preview.sl)}</p>}
              </div>
            </div>
          )}

          {(preview.tp || preview.sl) && (
            <div className="mb-3 flex gap-3 rounded bg-surface-muted px-3 py-1.5 text-xs">
              {preview.tp && <span>TP: <span className="text-emerald-400">{fmtPrice(preview.tp)}</span></span>}
              {preview.sl && <span>SL: <span className="text-red-400">{fmtPrice(preview.sl)}</span></span>}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => onConfirmTpSl(preview.tp, preview.sl)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-400 py-1.5 text-xs text-blue-400 hover:bg-blue-950/30">
              <IconCheck size={13} />Confirmer TP/SL
            </button>
            <button onClick={onCancel}
              className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-neutral-400 hover:bg-surface-muted">
              Annuler
            </button>
          </div>
        </>
      )}

      {tab === 'partial' && (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            Ajoute plusieurs niveaux de TP. À chaque niveau atteint, le % de position défini sera fermé automatiquement.
          </p>

          {/* Niveaux existants */}
          {partialTPs.length > 0 && (
            <div className="mb-3 flex flex-col gap-1">
              {[...partialTPs].sort((a, b) => isLong ? a.price - b.price : b.price - a.price).map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded bg-surface-muted px-2.5 py-1.5 text-xs">
                  <span className="text-emerald-400 font-medium">{fmtPrice(t.price)}</span>
                  <span className="text-neutral-500">→ ferme</span>
                  <span className="font-medium">{t.pct}%</span>
                  <span className="ml-auto text-neutral-500">
                    ({pos.side === 'LONG' ? '+' : '-'}{(Math.abs(t.price - pos.entryPrice) / pos.entryPrice * 100).toFixed(2)}% depuis entrée)
                  </span>
                  <button onClick={() => removePartialTP(t.id)} className="text-neutral-500 hover:text-red-400">
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between px-1 text-[10px] text-neutral-500">
                <span>Total fermé: {totalPct}%</span>
                <span>Restant: {100 - totalPct}%</span>
              </div>
            </div>
          )}

          {/* Formulaire d'ajout */}
          {totalPct < 100 && (
            <div className="mb-3 rounded-lg border border-border-soft p-2.5">
              <p className="mb-2 text-xs font-medium text-neutral-400">Ajouter un niveau</p>
              <div className="mb-2 flex gap-1">
                <button onClick={() => setNewPriceMode('price')}
                  className={`flex-1 rounded border py-0.5 text-xs ${newPriceMode === 'price'
                    ? 'border-blue-400 text-blue-400' : 'border-border-soft text-neutral-500'}`}>
                  Prix ($)
                </button>
                <button onClick={() => setNewPriceMode('pct')}
                  className={`flex-1 rounded border py-0.5 text-xs ${newPriceMode === 'pct'
                    ? 'border-blue-400 text-blue-400' : 'border-border-soft text-neutral-500'}`}>
                  % depuis entrée
                </button>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">
                    {newPriceMode === 'price' ? 'Prix cible ($)' : `% gain (${isLong ? 'hausse' : 'baisse'})`}
                  </label>
                  {newPriceMode === 'price' ? (
                    <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                      placeholder={`ex: ${isLong ? Math.round(pos.entryPrice * 1.05) : Math.round(pos.entryPrice * 0.95)}`}
                      className="h-7 w-full rounded border border-border-soft bg-surface-muted px-2 text-xs outline-none focus:border-emerald-400" />
                  ) : (
                    <div className="relative">
                      <input type="number" min={0} value={newPctGain} onChange={(e) => setNewPctGain(e.target.value)}
                        placeholder="ex: 5"
                        className="h-7 w-full rounded border border-border-soft bg-surface-muted px-2 pr-6 text-xs outline-none focus:border-emerald-400" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">%</span>
                    </div>
                  )}
                  {partialPrice && <p className="mt-0.5 text-[10px] text-emerald-400">→ {fmtPrice(partialPrice)}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-neutral-500">Fermer (% position)</label>
                  <div className="relative">
                    <input type="number" min={1} max={100 - totalPct} value={newPct} onChange={(e) => setNewPct(e.target.value)}
                      placeholder={`max ${100 - totalPct}%`}
                      className="h-7 w-full rounded border border-border-soft bg-surface-muted px-2 pr-6 text-xs outline-none focus:border-blue-400" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">%</span>
                  </div>
                </div>
              </div>
              <button onClick={addPartialTP}
                disabled={!computePartialPrice() || !parseFloat(newPct) || totalPct + parseFloat(newPct || '0') > 100}
                className="flex w-full items-center justify-center gap-1 rounded border border-emerald-500/50 py-1 text-xs text-emerald-400 hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-40">
                <IconPlus size={12} />Ajouter ce niveau
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => onConfirmPartialTPs(partialTPs)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-400 py-1.5 text-xs text-blue-400 hover:bg-blue-950/30">
              <IconCheck size={13} />Enregistrer les niveaux
            </button>
            <button onClick={onCancel}
              className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-neutral-400 hover:bg-surface-muted">
              Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Ajouter marge ────────────────────────────────────────────────────────────
function AddMarginRow({ pos, price, cash, onConfirm, onCancel }: {
  pos: Position; price: number; cash: number;
  onConfirm: (margin: number) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const margin = parseFloat(value) || 0;
  const addedQty = margin > 0 ? (margin * pos.leverage) / price : 0;
  const newQty = pos.qty + addedQty;
  const newAvg = newQty > 0 ? (pos.qty * pos.entryPrice + addedQty * price) / newQty : pos.entryPrice;
  const newMargin = pos.margin + margin;
  const invalid = margin <= 0 || margin > cash;

  return (
    <div className="mt-2 rounded-lg border border-border-soft bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-neutral-400">Ajouter à la position</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="marge à ajouter ($)" autoFocus
          className="h-8 w-40 rounded border border-border-soft bg-surface-muted px-2 text-xs outline-none focus:border-blue-400" />
        {margin > 0 && !invalid && (
          <span className="text-xs text-neutral-500">
            Prix moy: <span className="text-foreground">{fmtPrice(newAvg)}</span>
            {' · '}Marge: <span className="text-foreground">{fmt(newMargin)}</span>
          </span>
        )}
        {margin > cash && <p className="text-xs text-red-400">Solde insuffisant</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onConfirm(margin)} disabled={invalid}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/50 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-40">
          <IconCheck size={13} />Confirmer
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-neutral-400 hover:bg-surface-muted">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────
type PanelType = 'close' | 'tpsl' | 'add' | null;

export function PositionsList({
  positions, prices, cash, tradingState,
  onClose, onPartialClose, onAddToPosition, onSwitchMarginMode, onUpdateTpSl, onUpdatePartialTPs,
}: PositionsListProps) {
  const [activePanel, setActivePanel] = useState<{ id: string; panel: PanelType }>({ id: '', panel: null });

  function toggle(id: string, panel: PanelType) {
    setActivePanel((prev) =>
      prev.id === id && prev.panel === panel ? { id: '', panel: null } : { id, panel }
    );
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg bg-surface-muted p-3 text-center text-sm text-neutral-400">
        Aucune position ouverte
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {positions.map((pos) => {
        const currentPrice = prices[pos.pair] || pos.entryPrice;
        const pnl = positionPnl(pos, prices);
        const pnlPct = (pnl / pos.margin) * 100;
        const positive = pnl >= 0;
        const liqPrice = effectiveLiquidationPrice(pos, tradingState, prices);
        const sideColor = pos.side === 'LONG' ? 'text-emerald-400' : 'text-red-400';
        const isCross = pos.marginMode === 'cross';
        const isActive = (panel: PanelType) => activePanel.id === pos.id && activePanel.panel === panel;
        const pendingTPs = (pos.partialTPs ?? []).filter(t => !t.triggered);

        return (
          <div key={pos.id} className="rounded-lg bg-surface-muted p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[90px]">
                <p className="text-sm font-medium">{pos.pair.replace('USDT', '/USDT')}</p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs ${sideColor}`}>{pos.side} {pos.leverage}x</p>
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                    isCross ? 'bg-purple-950/40 text-purple-400' : 'bg-orange-950/30 text-orange-400'}`}>
                    {isCross ? 'CROSS' : 'ISO'}
                  </span>
                </div>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Entrée moy.</p>
                <p className="text-sm">{fmtPrice(pos.entryPrice)}</p>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Actuel</p>
                <p className="text-sm">{fmtPrice(currentPrice)}</p>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Marge</p>
                <p className="text-sm">{fmt(pos.margin)}</p>
              </div>
              <div className="min-w-[110px]">
                <p className="text-xs text-neutral-500">P&L</p>
                <p className={`text-sm ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {positive ? '+' : ''}{fmt(pnl)} ({positive ? '+' : ''}{pnlPct.toFixed(1)}%)
                </p>
              </div>
              <div className="min-w-[140px] text-xs text-neutral-500">
                <p>Liq: {fmtPrice(liqPrice)}</p>
                <p className={pos.tp ? 'text-emerald-400/80' : ''}>TP: {pos.tp ? fmtPrice(pos.tp) : '—'}</p>
                <p className={pos.sl ? 'text-red-400/80' : ''}>SL: {pos.sl ? fmtPrice(pos.sl) : '—'}</p>
                {pendingTPs.length > 0 && (
                  <p className="text-emerald-400/60">
                    TP partiels: {pendingTPs.map(t => `${t.pct}%@${fmtPrice(t.price)}`).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Barre d'actions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => toggle(pos.id, 'close')}
                className={`rounded border px-2.5 py-1 text-xs ${isActive('close')
                  ? 'border-red-400 bg-red-950/20 text-red-400'
                  : 'border-border-soft text-neutral-400 hover:bg-surface'}`}>
                Fermer partiellement
              </button>
              <button onClick={() => toggle(pos.id, 'tpsl')}
                className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs ${isActive('tpsl')
                  ? 'border-blue-400 bg-blue-950/20 text-blue-400'
                  : 'border-border-soft text-neutral-400 hover:bg-surface'}`}>
                <IconEdit size={12} />TP / SL
                {pendingTPs.length > 0 && (
                  <span className="ml-0.5 rounded bg-emerald-900/50 px-1 text-[10px] text-emerald-400">
                    {pendingTPs.length}
                  </span>
                )}
              </button>
              <button onClick={() => toggle(pos.id, 'add')}
                className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs ${isActive('add')
                  ? 'border-blue-400 bg-blue-950/20 text-blue-400'
                  : 'border-border-soft text-neutral-400 hover:bg-surface'}`}>
                <IconPlus size={12} />Ajouter
              </button>
              <button
                onClick={() => {
                  const newMode = isCross ? 'isolated' : 'cross';
                  const confirmed = window.confirm(
                    `Passer en ${newMode.toUpperCase()} va fermer la position au prix actuel et la réouvrir dans le nouveau mode.\n\nContinuer ?`
                  );
                  if (confirmed) onSwitchMarginMode(pos.id, newMode, currentPrice);
                }}
                className={`rounded border px-2.5 py-1 text-xs ${
                  isCross
                    ? 'border-purple-400/50 text-purple-400 hover:bg-purple-950/30'
                    : 'border-orange-400/50 text-orange-400 hover:bg-orange-950/30'}`}>
                → {isCross ? 'Isolated' : 'Cross'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Fermer 100% de ${pos.pair.replace('USDT', '/USDT')} ?`)) onClose(pos.id);
                }}
                className="ml-auto flex items-center gap-1 rounded border border-border-soft px-2.5 py-1 text-xs text-neutral-400 hover:bg-surface">
                <IconX size={13} />Fermer tout
              </button>
            </div>

            {/* Panneaux contextuels */}
            {isActive('close') && (
              <ClosePanel pos={pos} price={currentPrice}
                onConfirm={(pct) => { onPartialClose(pos.id, pct, currentPrice); setActivePanel({ id: '', panel: null }); }}
                onCancel={() => setActivePanel({ id: '', panel: null })} />
            )}
            {isActive('tpsl') && (
              <TpSlPanel pos={pos}
                onConfirmTpSl={(tp, sl) => { onUpdateTpSl(pos.id, tp, sl); setActivePanel({ id: '', panel: null }); }}
                onConfirmPartialTPs={(tps) => { onUpdatePartialTPs(pos.id, tps); setActivePanel({ id: '', panel: null }); }}
                onCancel={() => setActivePanel({ id: '', panel: null })} />
            )}
            {isActive('add') && (
              <AddMarginRow pos={pos} price={currentPrice} cash={cash}
                onConfirm={(margin) => { onAddToPosition(pos.id, margin, currentPrice); setActivePanel({ id: '', panel: null }); }}
                onCancel={() => setActivePanel({ id: '', panel: null })} />
            )}
          </div>
        );
      })}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, ArrowRight, RefreshCw, Settings, SlidersHorizontal, Play } from 'lucide-react';

const formatIndianNumber = (val) => {
  if (val >= 10000000) return (val / 10000000).toFixed(1) + 'Cr';
  if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val;
};

// 1. Candlestick Shape
const Candlestick = (props) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;
  const { open, close, high, low } = payload;
  const isGrowing = close >= open;
  const color = isGrowing ? '#22c55e' : '#ef4444';
  const priceDiff = high - low;
  const pxPerPrice = priceDiff === 0 ? 0 : height / priceDiff;
  const bodyTopVal = Math.max(open, close);
  const bodyBottomVal = Math.min(open, close);
  const bodyY = y + (high - bodyTopVal) * pxPerPrice;
  const bodyHeight = Math.max((bodyTopVal - bodyBottomVal) * pxPerPrice, 1);
  return (
    <g stroke={color} fill={color} strokeWidth="1.5">
      {priceDiff > 0 && <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} />}
      <rect x={x} y={bodyY} width={width} height={bodyHeight} />
    </g>
  );
};

// 2. OHLC Price Bar Shape (Replaces standard Line)
const OHLCBar = (props) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;
  const { open, close, high, low } = payload;
  const isGrowing = close >= open;
  const color = isGrowing ? '#22c55e' : '#ef4444';
  const priceDiff = high - low;
  const pxPerPrice = priceDiff === 0 ? 0 : height / priceDiff;
  const yHigh = y;
  const yLow = y + height;
  const yOpen = y + (high - open) * pxPerPrice;
  const yClose = y + (high - close) * pxPerPrice;
  const midX = x + width / 2;
  return (
    <g stroke={color} fill="none" strokeWidth="1.5">
      <line x1={midX} y1={yHigh} x2={midX} y2={yLow} />
      <line x1={x} y1={yOpen} x2={midX} y2={yOpen} />
      <line x1={midX} y1={yClose} x2={x + width} y2={yClose} />
    </g>
  );
};

// 3. Custom Volume Bar (Color-coded to match candles)
const CustomVolumeBar = (props) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;
  const { open, close } = payload;
  const isGrowing = close >= open;
  const color = isGrowing ? '#22c55e80' : '#ef444480';
  return <rect x={x} y={y} width={width} height={height} fill={color} />;
};

export default function App() {
  const [githubUser, setGithubUser] = useState(localStorage.getItem('gh_user') || 'amikaw');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('gh_repo') || 'nse-stock-track');
  const [githubBranch, setGithubBranch] = useState(localStorage.getItem('gh_branch') || 'main');
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenerConfig, setShowScreenerConfig] = useState(false);

  const [view, setView] = useState('main'); 
  const [activeTab, setActiveTab] = useState('screener'); 
  const [selectedStock, setSelectedStock] = useState(null);
  
  const [timeframe, setTimeframe] = useState('daily'); 
  const [chartType, setChartType] = useState('candle'); 
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [availableStocks, setAvailableStocks] = useState([]);
  const [fetchingStockList, setFetchingStockList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [screenerResults, setScreenerResults] = useState([]);
  const [activeScreener, setActiveScreener] = useState(null);
  const [isScreening, setIsScreening] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [screenerParams, setScreenerParams] = useState(() => {
    const saved = localStorage.getItem('equiscreen_params');
    return saved ? JSON.parse(saved) : { highPct: 5, lowPct: 15, insideBarLookback: 2 };
  });

  const [watchlists, setWatchlists] = useState(() => {
    const saved = localStorage.getItem('equiscreen_watchlists');
    return saved ? JSON.parse(saved) : { 'My Favorites': ['RELIANCE', 'TCS'] };
  });
  const [currentWatchlist, setCurrentWatchlist] = useState('My Favorites');

  useEffect(() => { localStorage.setItem('equiscreen_watchlists', JSON.stringify(watchlists)); }, [watchlists]);
  useEffect(() => { localStorage.setItem('equiscreen_params', JSON.stringify(screenerParams)); }, [screenerParams]);

  const loadStockListFromRepo = async () => {
    setFetchingStockList(true);
    try {
      let response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/EQUITY_L.csv`);
      if (!response.ok) {
        const altBranch = githubBranch === 'main' ? 'master' : 'main';
        response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/EQUITY_L.csv`);
        if (response.ok) setGithubBranch(altBranch);
      }
      const text = await response.text();
      const lines = text.trim().replace(/\r/g, '').split('\n');
      if (lines.length > 1) {
        const symbolIdx = lines[0].split(',').findIndex(h => h.trim().replace(/"/g, '').toUpperCase() === 'SYMBOL');
        let symbols = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
          if (symbolIdx !== -1 && cols[symbolIdx]) symbols.push(cols[symbolIdx].toUpperCase());
        }
        if (symbols.length > 0) setAvailableStocks(symbols);
      }
    } catch (err) {
      setAvailableStocks(['RELIANCE', 'TCS', 'HDFCBANK']);
    } finally {
      setFetchingStockList(false);
    }
  };

  useEffect(() => { loadStockListFromRepo(); }, [githubUser, githubRepo]);

  const aggregateToWeekly = (dailyData) => {
    if (!dailyData || dailyData.length === 0) return [];
    let weekly = [];
    let currentWeek = null;

    dailyData.forEach((day) => {
      const dateObj = new Date(day.date);
      const jan1 = new Date(dateObj.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((dateObj - jan1) / 86400000) + jan1.getDay() + 1) / 7);
      const weekKey = `${dateObj.getFullYear()}-W${weekNum}`;

      if (!currentWeek || currentWeek.weekKey !== weekKey) {
        if (currentWeek) weekly.push({ ...currentWeek, candleRange: [currentWeek.low, currentWeek.high] });
        currentWeek = { ...day, weekKey };
      } else {
        currentWeek.high = Math.max(currentWeek.high, day.high);
        currentWeek.low = Math.min(currentWeek.low, day.low);
        currentWeek.close = day.close;
        currentWeek.volume += day.volume;
        currentWeek.date = day.date;
      }
    });
    if (currentWeek) weekly.push({ ...currentWeek, candleRange: [currentWeek.low, currentWeek.high] });

    const calcSMA = (data, period, key) => data.map((item, idx) => {
      if (idx < period - 1) return { ...item, [key]: null };
      let sum = 0;
      for (let i = 0; i < period; i++) sum += data[idx - i].close;
      return { ...item, [key]: sum / period };
    });
    const calcVolSMA = (data, period, key) => data.map((item, idx) => {
      if (idx < period - 1) return { ...item, [key]: null };
      let sum = 0;
      for (let i = 0; i < period; i++) sum += data[idx - i].volume;
      return { ...item, [key]: sum / period };
    });

    weekly = calcSMA(weekly, 10, 'ma10');
    weekly = calcSMA(weekly, 20, 'ma20');
    weekly = calcSMA(weekly, 40, 'ma40');
    
    // Weekly Volume MAs
    weekly = calcVolSMA(weekly, 20, 'vol_ma20');
    weekly = calcVolSMA(weekly, 50, 'vol_ma50');
    return weekly;
  };

  const fetchStockData = async (symbol) => {
    setLoading(true); setErrorMsg(null);
    const cleanSymbol = symbol.trim().toUpperCase();
    try {
      let response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/data/${cleanSymbol}_data.csv`);
      if (!response.ok) {
        const altBranch = githubBranch === 'main' ? 'master' : 'main';
        response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/data/${cleanSymbol}_data.csv`);
      }
      if (!response.ok) throw new Error(`Data not found`);
      
      const text = await response.text();
      const lines = text.trim().replace(/\r/g, '').split('\n');
      if (lines.length <= 1) throw new Error(`Empty CSV`);
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const openIdx = headers.findIndex(h => h.includes('open'));
      const highIdx = headers.findIndex(h => h.includes('high'));
      const lowIdx = headers.findIndex(h => h.includes('low'));
      const closeIdx = headers.findIndex(h => h.includes('close'));
      const volIdx = headers.findIndex(h => h.includes('volume'));

      let parsedData = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 5) continue;
        const date = row[dateIdx]?.split(' ')[0] || '';
        const open = parseFloat(row[openIdx]);
        const high = parseFloat(row[highIdx]);
        const low = parseFloat(row[lowIdx]);
        const close = parseFloat(row[closeIdx]);
        const volume = parseFloat(row[volIdx]) || 0;
        
        if (!isNaN(close) && !isNaN(open) && !isNaN(high) && !isNaN(low)) {
          parsedData.push({ date, open, high, low, close, volume, candleRange: [low, high] });
        }
      }

      if (parsedData.length === 0) throw new Error(`Invalid data`);

      const calcDailySMA = (data, period, key) => data.map((item, idx) => {
        if (idx < period - 1) return { ...item, [key]: null };
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[idx - i].close;
        return { ...item, [key]: sum / period };
      });
      const calcVolSMA = (data, period, key) => data.map((item, idx) => {
        if (idx < period - 1) return { ...item, [key]: null };
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[idx - i].volume;
        return { ...item, [key]: sum / period };
      });

      // Daily Price MAs
      parsedData = calcDailySMA(parsedData, 10, 'ma10');
      parsedData = calcDailySMA(parsedData, 20, 'ma20');
      parsedData = calcDailySMA(parsedData, 50, 'ma50');
      parsedData = calcDailySMA(parsedData, 200, 'ma200');
      
      // Daily Volume MAs
      parsedData = calcVolSMA(parsedData, 20, 'vol_ma20');
      parsedData = calcVolSMA(parsedData, 50, 'vol_ma50');

      let finalDataset = timeframe === 'weekly' ? aggregateToWeekly(parsedData) : parsedData;
      setStockData(finalDataset);
      setZoomRange({ start: Math.max(0, finalDataset.length - 80), end: finalDataset.length });
    } catch (err) {
      setErrorMsg(err.message); setStockData([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (selectedStock) fetchStockData(selectedStock); }, [selectedStock, timeframe]);

  const runLiveScan = async (type) => {
    setIsScreening(true); setActiveScreener(type); setScreenerResults([]); setScanProgress(0);
    const listToScan = availableStocks.slice(0, 150); 
    const results = [];
    
    for (let i = 0; i < listToScan.length; i++) {
        const sym = listToScan[i];
        setScanProgress(Math.floor((i / listToScan.length) * 100));
        
        try {
            const res = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/data/${sym}_data.csv`);
            if (res.ok) {
                const text = await res.text();
                const lines = text.trim().replace(/\r/g, '').split('\n');
                if (lines.length > 20) {
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    const highIdx = headers.findIndex(h => h.includes('high'));
                    const lowIdx = headers.findIndex(h => h.includes('low'));
                    const closeIdx = headers.findIndex(h => h.includes('close'));
                    
                    let max52w = 0, min52w = 999999;
                    const recentData = lines.slice(-250);
                    recentData.forEach(rowStr => {
                        const r = rowStr.split(',');
                        const h = parseFloat(r[highIdx]); const l = parseFloat(r[lowIdx]);
                        if (h > max52w) max52w = h;
                        if (l < min52w) min52w = l;
                    });
                    
                    const lastRow = recentData[recentData.length - 1].split(',');
                    const currentClose = parseFloat(lastRow[closeIdx]);
                    
                    if (type === '52wHigh') {
                        const distFromHigh = ((max52w - currentClose) / max52w) * 100;
                        if (distFromHigh <= screenerParams.highPct) results.push(sym);
                    } else if (type === '52wLow') {
                        const distFromLow = ((currentClose - min52w) / min52w) * 100;
                        if (distFromLow >= screenerParams.lowPct) results.push(sym);
                    }
                }
            }
        } catch(e) {}
    }
    
    setScreenerResults(results);
    setScanProgress(100);
    setTimeout(() => setIsScreening(false), 500);
  };

  const navigateStock = (dir) => {
    const list = activeTab === 'screener' ? screenerResults : (activeTab === 'all' ? availableStocks : watchlists[currentWatchlist] || []);
    const idx = list.indexOf(selectedStock);
    if (dir === 'next' && idx < list.length - 1) setSelectedStock(list[idx + 1]);
    if (dir === 'prev' && idx > 0) setSelectedStock(list[idx - 1]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {showScreenerConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-400">Screener Settings</h3>
            <label className="block text-sm text-gray-300 mb-1">Within X% of 52-Week High</label>
            <div className="flex items-center gap-2 mb-4">
              <input type="range" min="1" max="20" value={screenerParams.highPct} onChange={(e) => setScreenerParams({...screenerParams, highPct: parseInt(e.target.value)})} className="flex-1" />
              <span className="text-sm font-bold w-10 text-right">{screenerParams.highPct}%</span>
            </div>
            <label className="block text-sm text-gray-300 mb-1">More than Y% above 52-Week Low</label>
            <div className="flex items-center gap-2 mb-4">
              <input type="range" min="5" max="100" step="5" value={screenerParams.lowPct} onChange={(e) => setScreenerParams({...screenerParams, lowPct: parseInt(e.target.value)})} className="flex-1" />
              <span className="text-sm font-bold w-10 text-right">{screenerParams.lowPct}%</span>
            </div>
            <button onClick={() => setShowScreenerConfig(false)} className="w-full py-2 bg-blue-600 rounded font-medium">Save Settings</button>
          </div>
        </div>
      )}

      {view === 'main' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <div><h1 className="text-lg font-bold text-blue-400">EquiScreen Pro</h1></div>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-gray-800 rounded text-gray-300"><Settings className="w-4 h-4" /></button>
          </div>

          <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'all' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>All</button>
            <button onClick={() => setActiveTab('screener')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Screeners</button>
            <button onClick={() => setActiveTab('watchlist')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Watchlists</button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4 bg-gray-950">
            <div className="mb-3 shrink-0">
              {activeTab === 'screener' && (
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden items-center">
                  <button onClick={() => setShowScreenerConfig(true)} className="p-2 bg-gray-800 rounded-lg border border-gray-700 text-gray-300"><SlidersHorizontal className="w-4 h-4" /></button>
                  <button onClick={() => runLiveScan('52wHigh')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wHigh' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700'}`}><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Near 52W High</button>
                  <button onClick={() => runLiveScan('52wLow')} className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wLow' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700'}`}><Play className="w-3.5 h-3.5 mr-1.5" /> Breakout from Low</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {isScreening ? (
                <div className="flex flex-col items-center justify-center pt-12 space-y-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-gray-400 text-sm">Live Scanning Market... {scanProgress}%</p>
                  <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${scanProgress}%`}}></div></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(activeTab === 'all' ? availableStocks.slice(0, 100) : activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []).map(stock => (
                    <div key={stock} onClick={() => { setSelectedStock(stock); setView('chart'); }} className="bg-gray-900 border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-blue-500 flex justify-between">
                      <h3 className="font-bold">{stock}</h3>
                      <span className="text-xs px-2 py-1 bg-blue-950 text-blue-400 rounded">Chart</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'chart' && (
        <div className="flex flex-col h-full relative">
          <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-2 shrink-0 z-20">
            <div className="flex items-center">
              <button onClick={() => setView('main')} className="p-2 mr-1 hover:bg-gray-800 rounded-full"><ArrowLeft className="w-5 h-5 text-gray-300" /></button>
              <div><h2 className="text-base font-bold leading-tight">{selectedStock}</h2><span className="text-[10px] text-gray-400 uppercase">{timeframe}</span></div>
            </div>
            <div className="flex items-center gap-1">
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>W</button>
              </div>
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'candle' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Cnd</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'bar' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Bar</button>
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-950 p-1">
            <button onClick={() => navigateStock('prev')} className="absolute left-1 top-1/2 z-30 p-1.5 bg-gray-900/80 rounded-full border border-gray-700 -translate-y-1/2"><ArrowLeft className="w-4 h-4 text-gray-300" /></button>
            <button onClick={() => navigateStock('next')} className="absolute right-1 top-1/2 z-30 p-1.5 bg-gray-900/80 rounded-full border border-gray-700 -translate-y-1/2"><ArrowRight className="w-4 h-4 text-gray-300" /></button>

            {loading && <div className="absolute inset-0 z-40 bg-gray-950/80 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}
            
            {!loading && stockData.length > 0 && (
              <>
                <div className="absolute top-2 right-10 z-20 flex space-x-1 bg-gray-900/80 rounded p-1 border border-gray-700">
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.min(p.start + 15, p.end - 10)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomIn className="w-4 h-4"/></button>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.max(0, p.start - 15)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomOut className="w-4 h-4"/></button>
                </div>

                <div className="flex-1 min-h-[250px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize: 9}} minTickGap={20} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7280" tick={{fontSize: 9}} orientation="right" width={40} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px'}} />
                      
                      {/* TOGGLE BETWEEN CANDLE AND OHLC PRICE BAR */}
                      <Bar dataKey="candleRange" shape={chartType === 'candle' ? <Candlestick /> : <OHLCBar />} />
                      
                      <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey={timeframe === 'daily' ? "ma200" : "ma40"} stroke="#8b5cf6" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-24 shrink-0 mb-1 border-t border-gray-800 pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#6b7280" tick={{fontSize: 9}} tickFormatter={formatIndianNumber} orientation="right" width={40} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px'}} formatter={(value) => formatIndianNumber(value)} />
                      
                      {/* Custom Volume Bar and Volume Moving Averages */}
                      <Bar dataKey="volume" shape={<CustomVolumeBar />} />
                      <Line type="monotone" dataKey="vol_ma20" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey="vol_ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

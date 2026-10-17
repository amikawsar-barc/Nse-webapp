import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, ArrowRight, RefreshCw, Settings, SlidersHorizontal, Play, BarChart2, Star, Sun, Moon } from 'lucide-react';

const formatIndianNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (val >= 10000000) return (val / 10000000).toFixed(1) + 'Cr';
  if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toString();
};

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

export default function App() {
  const [githubUser, setGithubUser] = useState(localStorage.getItem('gh_user') || 'amikaw');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('gh_repo') || 'nse-stock-track');
  const [githubBranch, setGithubBranch] = useState(localStorage.getItem('gh_branch') || 'main');
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenerConfig, setShowScreenerConfig] = useState(false);

  // --- THEME STATE ---
  const [theme, setTheme] = useState(() => localStorage.getItem('equiscreen_theme') || 'dark');
  useEffect(() => { localStorage.setItem('equiscreen_theme', theme); }, [theme]);
  
  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-900';
  const bgPanel = isDark ? 'bg-gray-900' : 'bg-gray-100';
  const borderCol = isDark ? 'border-gray-800' : 'border-gray-300';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const btnBg = isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-200 border border-gray-300';
  const gridColor = isDark ? '#1f2937' : '#e5e7eb';
  const tickColor = isDark ? '#ffffff' : '#000000';
  const axisText = isDark ? '#6b7280' : '#6b7280';
  const tooltipBg = isDark ? '#111827' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#d1d5db';

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
  
  const [screenerResults, setScreenerResults] = useState([]);
  const [activeScreener, setActiveScreener] = useState(null);
  const [isScreening, setIsScreening] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const [screenerParams, setScreenerParams] = useState(() => {
    const saved = localStorage.getItem('equiscreen_params');
    return saved ? JSON.parse(saved) : { highPct: 25, lowPct: 50 };
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
      setAvailableStocks(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'ITC', 'SBIN']);
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

      parsedData = calcDailySMA(parsedData, 10, 'ma10');
      parsedData = calcDailySMA(parsedData, 20, 'ma20');
      parsedData = calcDailySMA(parsedData, 50, 'ma50');
      parsedData = calcDailySMA(parsedData, 200, 'ma200');
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
    
    const listToScan = availableStocks; 
    let results = [];
    const batchSize = 25;

    for (let i = 0; i < listToScan.length; i += batchSize) {
        const batch = listToScan.slice(i, i + batchSize);
        const batchPromises = batch.map(async (sym) => {
            try {
                const res = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/data/${sym}_data.csv`);
                if (res.ok) {
                    const text = await res.text();
                    const lines = text.trim().replace(/\r/g, '').split('\n');
                    if (lines.length > 20) {
                        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                        const dateIdx = headers.findIndex(h => h.includes('date'));
                        const openIdx = headers.findIndex(h => h.includes('open'));
                        const highIdx = headers.findIndex(h => h.includes('high'));
                        const lowIdx = headers.findIndex(h => h.includes('low'));
                        const closeIdx = headers.findIndex(h => h.includes('close'));
                        
                        if (type === 'insideBar') {
                            const recentDataLines = lines.slice(-40); 
                            let parsedDataForWeekly = [];
                            recentDataLines.forEach(rowStr => {
                                const r = rowStr.split(',');
                                if(r.length > closeIdx) {
                                    parsedDataForWeekly.push({
                                        date: r[dateIdx]?.split(' ')[0] || '',
                                        open: parseFloat(r[openIdx]),
                                        high: parseFloat(r[highIdx]),
                                        low: parseFloat(r[lowIdx]),
                                        close: parseFloat(r[closeIdx]),
                                        volume: 0
                                    });
                                }
                            });
                            const weekly = aggregateToWeekly(parsedDataForWeekly);
                            if (weekly.length >= 2) {
                                const w1 = weekly[weekly.length - 2];
                                const w2 = weekly[weekly.length - 1];
                                if (w2.high < w1.high && w2.low > w1.low) {
                                    return sym;
                                }
                            }
                            return null;
                        }

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
                        
                        const minHighThreshold = max52w * (1 - screenerParams.highPct / 100);
                        const minLowThreshold = min52w * (1 + screenerParams.lowPct / 100);

                        if (type === '52wHigh' && currentClose >= minHighThreshold) return sym;
                        if (type === '52wLow' && currentClose >= minLowThreshold) return sym;
                        if (type === 'combined' && currentClose >= minHighThreshold && currentClose >= minLowThreshold) return sym;
                    }
                }
            } catch(e) {}
            return null;
        });

        const batchResults = await Promise.all(batchPromises);
        results = [...results, ...batchResults.filter(Boolean)];
        setScanProgress(Math.floor((Math.min(i + batchSize, listToScan.length) / listToScan.length) * 100));
        
        await new Promise(r => setTimeout(r, 10)); 
    }
    
    setScreenerResults(results);
    setScanProgress(100);
    setIsScreening(false);
  };

  const navigateStock = (dir) => {
    const list = activeTab === 'screener' ? screenerResults : (activeTab === 'all' ? availableStocks : watchlists[currentWatchlist] || []);
    const idx = list.indexOf(selectedStock);
    if (dir === 'next' && idx < list.length - 1) setSelectedStock(list[idx + 1]);
    if (dir === 'prev' && idx > 0) setSelectedStock(list[idx - 1]);
  };

  const toggleWatchlist = () => {
    const list = watchlists[currentWatchlist] || [];
    if (list.includes(selectedStock)) {
      setWatchlists({...watchlists, [currentWatchlist]: list.filter(s => s !== selectedStock)});
    } else {
      setWatchlists({...watchlists, [currentWatchlist]: [...list, selectedStock]});
    }
  };

  const isWatchlisted = (watchlists[currentWatchlist] || []).includes(selectedStock);

  return (
    <div className={`flex flex-col h-[100dvh] w-full ${bgMain} font-sans overflow-hidden`}>
      
      {showScreenerConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className={`${bgPanel} border ${borderCol} rounded p-6 w-full max-w-sm`}>
            <h3 className="text-lg font-bold mb-4 text-blue-500">Screener Parameters</h3>
            
            <label className={`block text-sm ${textMuted} mb-1`}>Max % Distance from 52W High</label>
            <p className={`text-[11px] ${textMuted} mb-2`}>Price &ge; 52W_High &times; {(1 - screenerParams.highPct/100).toFixed(2)}</p>
            <div className="flex items-center gap-2 mb-4">
              <input type="range" min="1" max="75" value={screenerParams.highPct} onChange={(e) => setScreenerParams({...screenerParams, highPct: parseInt(e.target.value)})} className="flex-1" />
              <span className="text-sm font-bold w-12 text-right">{screenerParams.highPct}%</span>
            </div>
            
            <label className={`block text-sm ${textMuted} mb-1`}>Min % Above 52W Low</label>
            <p className={`text-[11px] ${textMuted} mb-2`}>Price &ge; 52W_Low &times; {(1 + screenerParams.lowPct/100).toFixed(2)}</p>
            <div className="flex items-center gap-2 mb-4">
              <input type="range" min="0" max="1000" step="5" value={screenerParams.lowPct} onChange={(e) => setScreenerParams({...screenerParams, lowPct: parseInt(e.target.value)})} className="flex-1" />
              <span className="text-sm font-bold w-12 text-right">{screenerParams.lowPct}%</span>
            </div>

            <button onClick={() => setShowScreenerConfig(false)} className="w-full py-2 bg-blue-600 text-white rounded font-medium">Save Parameters</button>
          </div>
        </div>
      )}

      {view === 'main' && (
        <>
          <div className={`flex items-center justify-between px-4 py-3 ${bgPanel} border-b ${borderCol} shrink-0`}>
            <div><h1 className="text-lg font-bold text-blue-500">EquiScreen Pro</h1></div>
            <div className="flex gap-2">
              <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded ${btnBg}`}>
                {isDark ? <Sun className="w-4 h-4 text-gray-300" /> : <Moon className="w-4 h-4 text-gray-600" />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded ${btnBg}`}><Settings className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} /></button>
            </div>
          </div>

          <div className={`flex ${bgPanel} border-b ${borderCol} shrink-0`}>
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'all' ? 'border-b-2 border-blue-500 text-blue-500' : textMuted}`}>All</button>
            <button onClick={() => setActiveTab('screener')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-500' : textMuted}`}>Screeners</button>
            <button onClick={() => setActiveTab('watchlist')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-500' : textMuted}`}>Watchlists</button>
          </div>

          <div className={`flex-1 overflow-hidden flex flex-col ${bgMain}`}>
            <div className="shrink-0 p-4 pb-2">
              {activeTab === 'screener' && (
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden items-center">
                  <button onClick={() => setShowScreenerConfig(true)} className={`p-2 rounded-lg border ${btnBg} shrink-0`}><SlidersHorizontal className="w-4 h-4" /></button>
                  <button onClick={() => runLiveScan('52wHigh')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wHigh' ? 'bg-blue-900 border-blue-500 text-blue-300' : btnBg} shrink-0`}><TrendingUp className="w-3.5 h-3.5 mr-1" /> Near High (&ge;{(100-screenerParams.highPct)}%)</button>
                  <button onClick={() => runLiveScan('52wLow')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wLow' ? 'bg-blue-900 border-blue-500 text-blue-300' : btnBg} shrink-0`}><Play className="w-3.5 h-3.5 mr-1" /> Above Low (&ge;{screenerParams.lowPct}%)</button>
                  <button onClick={() => runLiveScan('combined')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === 'combined' ? 'bg-blue-900 border-blue-500 text-blue-300' : btnBg} shrink-0`}>Combined Filter</button>
                  <button onClick={() => runLiveScan('insideBar')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === 'insideBar' ? 'bg-blue-900 border-blue-500 text-blue-300' : btnBg} shrink-0`}><BarChart2 className="w-3.5 h-3.5 mr-1" /> Weekly Inside Bar</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-24 h-full">
              {isScreening ? (
                <div className="flex flex-col items-center justify-center pt-12 space-y-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <p className={`text-sm ${textMuted}`}>Scanning {availableStocks.length} Stocks... {scanProgress}%</p>
                  <div className={`w-64 h-2 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full overflow-hidden`}><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${scanProgress}%`}}></div></div>
                </div>
              ) : (
                <>
                  {activeTab === 'screener' && screenerResults.length > 0 && <div className={`text-xs ${textMuted} mb-2`}>Found {screenerResults.length} matches.</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(activeTab === 'all' ? availableStocks : activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []).map(stock => (
                      <div key={stock} onClick={() => { setSelectedStock(stock); setView('chart'); }} className={`${bgPanel} border ${borderCol} p-4 rounded-lg cursor-pointer hover:border-blue-500 flex justify-between items-center`}>
                        <h3 className="font-bold">{stock}</h3>
                        <span className={`text-xs px-2 py-1 ${isDark ? 'bg-blue-950 text-blue-400' : 'bg-blue-100 text-blue-700'} rounded`}>Chart</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'chart' && (
        <div className={`flex flex-col h-[100dvh] w-full ${bgMain} relative overflow-hidden`}>
          <header className={`h-14 ${bgPanel} border-b ${borderCol} flex items-center justify-between px-2 shrink-0 z-20`}>
            <div className="flex items-center">
              <button onClick={() => setView('main')} className={`p-2 mr-1 rounded-full ${btnBg}`}><ArrowLeft className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} /></button>
              <div className="flex items-center">
                <div><h2 className="text-base font-bold leading-tight">{selectedStock}</h2><span className={`text-[10px] ${textMuted} uppercase`}>{timeframe}</span></div>
                <button onClick={toggleWatchlist} className="ml-3 p-1 rounded-full hover:bg-black/10">
                  <Star className={`w-5 h-5 ${isWatchlisted ? 'fill-yellow-500 text-yellow-500' : textMuted}`} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className={`rounded p-1 flex ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'daily' ? 'bg-blue-600 text-white' : textMuted}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : textMuted}`}>W</button>
              </div>
              <div className={`rounded p-1 flex ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'candle' ? (isDark?'bg-gray-600 text-white':'bg-white text-black') : textMuted}`}>Cnd</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'bar' ? (isDark?'bg-gray-600 text-white':'bg-white text-black') : textMuted}`}>Bar</button>
              </div>
            </div>
          </header>

          <main className="w-full h-[70dvh] flex flex-col relative shrink-0 p-1">
            <button onClick={() => navigateStock('prev')} className={`absolute left-1 top-1/3 z-30 p-1.5 rounded-full border ${btnBg} -translate-y-1/2`}><ArrowLeft className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} /></button>
            <button onClick={() => navigateStock('next')} className={`absolute right-1 top-1/3 z-30 p-1.5 rounded-full border ${btnBg} -translate-y-1/2`}><ArrowRight className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} /></button>

            {loading && <div className={`absolute inset-0 z-40 ${isDark ? 'bg-gray-950/80' : 'bg-white/80'} flex items-center justify-center`}><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}
            
            {!loading && stockData.length > 0 && (
              <>
                {/* ZOOM CONTROLS MOVED TO LEFT SIDE */}
                <div className={`absolute top-2 left-2 z-20 flex space-x-1 ${bgPanel} bg-opacity-90 rounded p-1 border ${borderCol}`}>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.min(p.start + 15, p.end - 10)}))} className={`p-1 rounded ${btnBg}`}><ZoomIn className={`w-4 h-4 ${isDark ? 'text-white' : 'text-black'}`}/></button>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.max(0, p.start - 15)}))} className={`p-1 rounded ${btnBg}`}><ZoomOut className={`w-4 h-4 ${isDark ? 'text-white' : 'text-black'}`}/></button>
                </div>

                {/* UPPER PANEL: PRICE CHART */}
                <div className="h-[70%] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" stroke={axisText} tick={{fontSize: 9}} minTickGap={20} hide padding={{ right: 35 }} />
                      <YAxis domain={['auto', 'auto']} stroke={axisText} tick={{fontSize: 11, fill: tickColor, fontWeight: 'bold'}} orientation="right" width={55} />
                      <Tooltip contentStyle={{backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tickColor, fontSize: '11px'}} itemStyle={{color: tickColor}} />
                      
                      <Bar dataKey="candleRange" shape={chartType === 'candle' ? <Candlestick /> : <OHLCBar />} />
                      <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} name="SMA 10" />
                      <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} name="SMA 50" />
                      <Line type="monotone" dataKey={timeframe === 'daily' ? "ma200" : "ma40"} stroke="#8b5cf6" dot={false} strokeWidth={2} name={timeframe === 'daily' ? "SMA 200" : "SMA 40"} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* LOWER PANEL: VOLUME CHART */}
                <div className={`h-[30%] w-full border-t ${borderCol} pt-1 pb-1`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" stroke={axisText} tick={{fontSize: 9}} minTickGap={20} padding={{ right: 35 }} />
                      <YAxis domain={[0, 'auto']} stroke={axisText} tick={{fontSize: 11, fill: tickColor, fontWeight: 'bold'}} tickFormatter={formatIndianNumber} orientation="right" width={55} />
                      <Tooltip contentStyle={{backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tickColor, fontSize: '11px'}} itemStyle={{color: tickColor}} formatter={(val) => [formatIndianNumber(val), "Volume"]} />
                      
                      <Bar dataKey="volume" isAnimationActive={false}>
                        {stockData.slice(zoomRange.start, zoomRange.end).map((entry, index) => (
                          <Cell key={`vol-cell-${index}`} fill={entry.close >= entry.open ? '#22c55e' : '#ef4444'} opacity={0.65} />
                        ))}
                      </Bar>

                      <Line type="monotone" dataKey="vol_ma20" stroke="#f59e0b" dot={false} strokeWidth={1.2} name="Vol SMA 20" />
                      <Line type="monotone" dataKey="vol_ma50" stroke="#ec4899" dot={false} strokeWidth={1.2} name="Vol SMA 50" />
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

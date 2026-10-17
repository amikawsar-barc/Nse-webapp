import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, ArrowRight, RefreshCw, Settings, SlidersHorizontal, Play, Layers } from 'lucide-react';

const formatIndianNumber = (val) => {
  if (val === None or val === undefined or isNaN(val)) return '0';
  if (val >= 10000000) return (val / 10000000).toFixed(2) + 'Cr';
  if (val >= 100000) return (val / 100000).toFixed(2) + 'L';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toFixed(0);
};

// 1. Candlestick Shape for Upper Chart
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
  const midX = x + width / 2;
  return (
    <g stroke={color} fill={color} strokeWidth="1.5">
      {priceDiff > 0 && <line x1={midX} y1={y} x2={midX} y2={y + height} />}
      <rect x={Math.max(x, 0)} y={bodyY} width={Math.max(width, 1)} height={bodyHeight} />
    </g>
  );
};

// 2. OHLC Price Bar Shape
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

  // Configurable screener parameters with expanded ranges
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
    
    // Weekly Volume MAs (20 and 50)
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
      if (!response.ok) throw new Error(`Data not found for ${cleanSymbol}`);
      
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

      if (parsedData.length === 0) throw new Error(`Invalid numerical data`);

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

  // LIVE SCREENER ENGINE WITH FLEXIBLE HIGH/LOW THRESHOLDS
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
                    
                    let max52w = 0, min52w = 99999999;
                    const recentData = lines.slice(-250); // approx 1 year trading days
                    recentData.forEach(rowStr => {
                        const r = rowStr.split(',');
                        const h = parseFloat(r[highIdx]); const l = parseFloat(r[lowIdx]);
                        if (!isNaN(h) && h > max52w) max52w = h;
                        if (!isNaN(l) && l < min52w && l > 0) min52w = l;
                    });
                    
                    const lastRow = recentData[recentData.length - 1].split(',');
                    const currentClose = parseFloat(lastRow[closeIdx]);
                    
                    if (!isNaN(currentClose) && max52w > 0 && min52w > 0) {
                        // Condition A: Close >= 52W High * (1 - highPct/100)
                        const highThreshold = max52w * (1 - screenerParams.highPct / 100);
                        const passesHigh = currentClose >= highThreshold;

                        // Condition B: Close >= 52W Low * (1 + lowPct/100)
                        const lowThreshold = min52w * (1 + screenerParams.lowPct / 100);
                        const passesLow = currentClose >= lowThreshold;

                        if (type === '52wHigh' && passesHigh) {
                            results.push(sym);
                        } else if (type === '52wLow' && passesLow) {
                            results.push(sym);
                        } else if (type === 'combined' && passesHigh && passesLow) {
                            results.push(sym);
                        }
                    }
                }
            }
        } catch(e) {}
    }
    
    setScreenerResults(results);
    setScanProgress(100);
    setTimeout(() => setIsScreening(false), 300);
  };

  const navigateStock = (dir) => {
    const list = activeTab === 'screener' ? screenerResults : (activeTab === 'all' ? availableStocks : watchlists[currentWatchlist] || []);
    const idx = list.indexOf(selectedStock);
    if (dir === 'next' && idx < list.length - 1) setSelectedStock(list[idx + 1]);
    if (dir === 'prev' && idx > 0) setSelectedStock(list[idx - 1]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {/* SCREENER CONFIG MODAL */}
      {showScreenerConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-blue-400 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5" /> Screener Criteria
            </h3>
            
            {/* 52-Week High Threshold Slider (Up to 75%) */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-300">Max % drop from 52W High</label>
                <span className="text-xs font-bold text-blue-400">{screenerParams.highPct}%</span>
              </div>
              <input 
                type="range" min="1" max="75" value={screenerParams.highPct} 
                onChange={(e) => setScreenerParams({...screenerParams, highPct: parseInt(e.target.value)})} 
                className="w-full accent-blue-500 bg-gray-800 rounded-lg cursor-pointer" 
              />
              <p className="text-[11px] text-gray-500 mt-1">Price $\ge$ High $\times$ {(1 - screenerParams.highPct / 100).toFixed(2)}</p>
            </div>
            
            {/* 52-Week Low Threshold Slider (Up to 1000%) */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-gray-300">Min % gain above 52W Low</label>
                <span className="text-xs font-bold text-blue-400">{screenerParams.lowPct}%</span>
              </div>
              <input 
                type="range" min="0" max="1000" step="10" value={screenerParams.lowPct} 
                onChange={(e) => setScreenerParams({...screenerParams, lowPct: parseInt(e.target.value)})} 
                className="w-full accent-blue-500 bg-gray-800 rounded-lg cursor-pointer" 
              />
              <p className="text-[11px] text-gray-500 mt-1">Price $\ge$ Low $\times$ {(1 + screenerParams.lowPct / 100).toFixed(2)}</p>
            </div>

            <button onClick={() => setShowScreenerConfig(false)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm transition-colors">Apply & Save</button>
          </div>
        </div>
      )}

      {/* GITHUB SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-400">GitHub Repository Config</h3>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input type="text" value={githubUser} onChange={(e) => setGithubUser(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-3 text-sm text-white" />
            <label className="block text-xs text-gray-400 mb-1">Repository</label>
            <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-3 text-sm text-white" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-xs bg-gray-800 rounded">Cancel</button>
              <button onClick={() => { localStorage.setItem('gh_user', githubUser); localStorage.setItem('gh_repo', githubRepo); setShowSettings(false); loadStockListFromRepo(); }} className="px-4 py-2 text-xs bg-blue-600 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN SCREEN */}
      {view === 'main' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <div><h1 className="text-lg font-bold text-blue-400">EquiScreen Pro</h1><p className="text-[10px] text-gray-500">{githubUser}/{githubRepo}</p></div>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-800 rounded-lg text-gray-300"><Settings className="w-4 h-4" /></button>
          </div>

          <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-3 text-xs font-semibold ${activeTab === 'all' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>All Tickers</button>
            <button onClick={() => setActiveTab('screener')} className={`flex-1 py-3 text-xs font-semibold ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Screeners</button>
            <button onClick={() => setActiveTab('watchlist')} className={`flex-1 py-3 text-xs font-semibold ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Watchlists</button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4 bg-gray-950">
            <div className="mb-3 shrink-0">
              {activeTab === 'all' && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" placeholder="Search ticker..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-blue-500" />
                </div>
              )}
              {activeTab === 'screener' && (
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden items-center">
                  <button onClick={() => setShowScreenerConfig(true)} className="p-2 bg-gray-800 rounded-lg border border-gray-700 text-gray-300 hover:text-white" title="Configure Thresholds"><SlidersHorizontal className="w-4 h-4" /></button>
                  <button onClick={() => runLiveScan('52wHigh')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wHigh' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}><TrendingUp className="w-3.5 h-3.5 mr-1" /> Near High ($\le${screenerParams.highPct}%)</button>
                  <button onClick={() => runLiveScan('52wLow')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === '52wLow' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}><Play className="w-3.5 h-3.5 mr-1" /> Above Low ($\ge${screenerParams.lowPct}%)</button>
                  <button onClick={() => runLiveScan('combined')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === 'combined' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}><Layers className="w-3.5 h-3.5 mr-1" /> Combined Scan</button>
                </div>
              )}
              {activeTab === 'watchlist' && (
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {Object.keys(watchlists).map(list => (
                    <button key={list} onClick={() => setCurrentWatchlist(list)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs border ${currentWatchlist === list ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}><Folder className="w-3.5 h-3.5 inline mr-1" /> {list}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {isScreening ? (
                <div className="flex flex-col items-center justify-center pt-12 space-y-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-gray-400 text-xs">Scanning market data... {scanProgress}%</p>
                  <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300" style={{width: `${scanProgress}%`}}></div></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(activeTab === 'all' ? availableStocks.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 100) : activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []).map(stock => (
                    <div key={stock} onClick={() => { setSelectedStock(stock); setView('chart'); }} className="bg-gray-900 border border-gray-800 p-3.5 rounded-xl cursor-pointer hover:border-blue-500 flex justify-between items-center transition-colors">
                      <div><h3 className="font-bold text-sm text-gray-100">{stock}</h3><p className="text-[10px] text-gray-500">NSE Equity</p></div>
                      <span className="text-[11px] px-2.5 py-1 bg-blue-950 text-blue-400 border border-blue-800/50 rounded-lg">Chart</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CHART VIEW SCREEN */}
      {view === 'chart' && (
        <div className="flex flex-col h-full relative">
          <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0 z-20">
            <div className="flex items-center">
              <button onClick={() => setView('main')} className="p-1.5 mr-1.5 hover:bg-gray-800 rounded-full"><ArrowLeft className="w-5 h-5 text-gray-300" /></button>
              <div><h2 className="text-sm font-bold leading-tight">{selectedStock}</h2><span className="text-[10px] text-gray-400 uppercase">{timeframe}</span></div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="bg-gray-800 rounded-lg p-0.5 flex">
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded-md font-semibold ${timeframe === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded-md font-semibold ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>W</button>
              </div>
              <div className="bg-gray-800 rounded-lg p-0.5 flex">
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded-md font-semibold ${chartType === 'candle' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Cnd</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded-md font-semibold ${chartType === 'bar' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Bar</button>
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-950 p-1">
            <button onClick={() => navigateStock('prev')} className="absolute left-1 top-1/2 z-30 p-2 bg-gray-900/80 hover:bg-gray-800 rounded-full border border-gray-700 -translate-y-1/2 shadow-lg"><ArrowLeft className="w-4 h-4 text-gray-300" /></button>
            <button onClick={() => navigateStock('next')} className="absolute right-1 top-1/2 z-30 p-2 bg-gray-900/80 hover:bg-gray-800 rounded-full border border-gray-700 -translate-y-1/2 shadow-lg"><ArrowRight className="w-4 h-4 text-gray-300" /></button>

            {loading && <div className="absolute inset-0 z-40 bg-gray-950/80 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}
            
            {!loading && stockData.length > 0 && (
              <div className="flex-1 flex flex-col h-full w-full">
                
                {/* ZOOM CONTROL OVERLAY */}
                <div className="absolute top-2 right-10 z-20 flex space-x-1 bg-gray-900/90 rounded-lg p-1 border border-gray-800 shadow">
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.min(p.start + 15, p.end - 10)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomIn className="w-3.5 h-3.5 text-gray-300"/></button>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.max(0, p.start - 15)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomOut className="w-3.5 h-3.5 text-gray-300"/></button>
                </div>

                {/* UPPER PANEL: PRICE CHART & PRICE MAs (~70% HEIGHT) */}
                <div className="flex-1 min-h-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize: 9}} minTickGap={25} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7280" tick={{fontSize: 9}} orientation="right" width={45} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px', borderRadius: '8px'}} />
                      
                      {/* Price Candles OR OHLC Price Bars */}
                      <Bar dataKey="candleRange" shape={chartType === 'candle' ? <Candlestick /> : <OHLCBar />} />
                      
                      {/* Price Moving Averages */}
                      <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} name="SMA 10" />
                      <Line type="monotone" dataKey="ma20" stroke="#10b981" dot={false} strokeWidth={1} name="SMA 20" />
                      <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} name="SMA 50" />
                      <Line type="monotone" dataKey={timeframe === 'daily' ? "ma200" : "ma40"} stroke="#8b5cf6" dot={false} strokeWidth={2} name={timeframe === 'daily' ? "SMA 200" : "SMA 40"} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* LOWER PANEL: DEDICATED VOLUME BARS + VOLUME 20, 50 SMA (~30% HEIGHT) */}
                <div className="h-32 min-h-[120px] shrink-0 border-t border-gray-800 pt-1 mt-1 relative bg-gray-950/50">
                  <div className="absolute top-1 left-2 z-10 text-[9px] font-semibold text-gray-500 uppercase flex items-center gap-2">
                    <span>Vol</span>
                    <span className="text-amber-500">SMA 20</span>
                    <span className="text-pink-500">SMA 50</span>
                  </div>
                  
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#6b7280" tick={{fontSize: 9}} tickFormatter={formatIndianNumber} orientation="right" width={45} domain={[0, 'auto']} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px', borderRadius: '8px'}} formatter={(val) => formatIndianNumber(val)} />
                      
                      {/* Volume Bars */}
                      <Bar dataKey="volume" name="Volume">
                        {stockData.slice(zoomRange.start, zoomRange.end).map((entry, index) => (
                          <Cell key={`vol-cell-${index}`} fill={entry.close >= entry.open ? '#22c55e80' : '#ef444480'} />
                        ))}
                      </Bar>
                      
                      {/* Volume Moving Averages (20 and 50) */}
                      <Line type="monotone" dataKey="vol_ma20" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Vol SMA 20" />
                      <Line type="monotone" dataKey="vol_ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} name="Vol SMA 50" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

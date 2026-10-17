import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, ArrowRight, RefreshCw, Settings, Play } from 'lucide-react';

// Custom Candlestick shape for Recharts - FIXED payload extraction
const Candlestick = (props) => {
  const { x, y, width, height, payload, yAxis } = props;
  if (!x || !y || !yAxis || !payload) return null;
  
  const { open, close, high, low } = payload;
  const isGrowing = close >= open;
  const color = isGrowing ? '#22c55e' : '#ef4444';
  
  const yTop = yAxis.scale(Math.max(open, close));
  const yBottom = yAxis.scale(Math.min(open, close));
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);
  
  return (
    <g stroke={color} fill={color} strokeWidth="1.5">
      <line x1={x + width / 2} y1={yHigh} x2={x + width / 2} y2={yTop} />
      <line x1={x + width / 2} y1={yBottom} x2={x + width / 2} y2={yLow} />
      <rect x={x} y={yTop} width={width} height={Math.max(yBottom - yTop, 1)} />
    </g>
  );
};

export default function App() {
  const [githubUser, setGithubUser] = useState(localStorage.getItem('gh_user') || 'amikaw');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('gh_repo') || 'nse-stock-track');
  const [githubBranch, setGithubBranch] = useState(localStorage.getItem('gh_branch') || 'main');
  const [showSettings, setShowSettings] = useState(false);

  const [view, setView] = useState('main'); 
  const [activeTab, setActiveTab] = useState('screener'); // 'all', 'screener', 'watchlist'
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
  
  // Screener states
  const [screenerResults, setScreenerResults] = useState([]);
  const [activeScreener, setActiveScreener] = useState(null);
  const [isScreening, setIsScreening] = useState(false);

  const [watchlists, setWatchlists] = useState(() => {
    const saved = localStorage.getItem('equiscreen_watchlists');
    return saved ? JSON.parse(saved) : {
      'My Favorites': ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'],
      'Breakout Candidates': ['ICICIBANK', 'BHARTIARTL', 'SBIN']
    };
  });
  const [currentWatchlist, setCurrentWatchlist] = useState('My Favorites');

  useEffect(() => {
    localStorage.setItem('equiscreen_watchlists', JSON.stringify(watchlists));
  }, [watchlists]);

  // Load all stocks
  const loadStockListFromRepo = async () => {
    setFetchingStockList(true);
    const url = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/EQUITY_L.csv`;
    
    try {
      let response = await fetch(url);
      if (!response.ok) {
        const altBranch = githubBranch === 'main' ? 'master' : 'main';
        response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/EQUITY_L.csv`);
        if (response.ok) {
          setGithubBranch(altBranch);
          localStorage.setItem('gh_branch', altBranch);
        } else {
          throw new Error('List not found');
        }
      }
      const text = await response.text();
      const lines = text.trim().replace(/\r/g, '').split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const symbolIdx = headers.findIndex(h => h.toUpperCase() === 'SYMBOL');
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

  useEffect(() => { loadStockListFromRepo(); }, [githubUser, githubRepo, githubBranch]);

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
        if (currentWeek) weekly.push(currentWeek);
        currentWeek = { ...day, weekKey };
      } else {
        currentWeek.high = Math.max(currentWeek.high, day.high);
        currentWeek.low = Math.min(currentWeek.low, day.low);
        currentWeek.close = day.close;
        currentWeek.volume += day.volume;
        currentWeek.date = day.date;
      }
    });
    if (currentWeek) weekly.push(currentWeek);

    const calcWeeklySMA = (data, period, key) => data.map((item, idx) => {
      if (idx < period - 1) return { ...item, [key]: null };
      let sum = 0;
      for (let i = 0; i < period; i++) sum += data[idx - i].close;
      return { ...item, [key]: sum / period };
    });
    weekly = calcWeeklySMA(weekly, 10, 'ma10');
    weekly = calcWeeklySMA(weekly, 20, 'ma20');
    weekly = calcWeeklySMA(weekly, 40, 'ma40');
    return weekly;
  };

  const fetchStockData = async (symbol) => {
    setLoading(true);
    setErrorMsg(null);
    const cleanSymbol = symbol.trim().toUpperCase();
    const url = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/data/${cleanSymbol}_data.csv`;
    
    try {
      let response = await fetch(url);
      if (!response.ok) {
        const altBranch = githubBranch === 'main' ? 'master' : 'main';
        response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/data/${cleanSymbol}_data.csv`);
      }
      if (!response.ok) throw new Error(`Data for ${cleanSymbol} not found.`);
      
      const csvText = await response.text();
      // FIX: Clean carriage returns before splitting lines
      const lines = csvText.trim().replace(/\r/g, '').split('\n');
      if (lines.length <= 1) throw new Error(`Empty CSV.`);
      
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
        const volume = parseFloat(row[volIdx]) || 0; // Use parseFloat for scientific notation or decimals in volume

        if (!isNaN(close) && !isNaN(open)) {
          parsedData.push({ date, open, high, low, close, volume });
        }
      }

      if (parsedData.length === 0) throw new Error(`No numerical data found.`);

      const calcSMA = (data, period, key) => data.map((item, idx) => {
        if (idx < period - 1) return { ...item, [key]: null };
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[idx - i].close;
        return { ...item, [key]: sum / period };
      });

      parsedData = calcSMA(parsedData, 10, 'ma10');
      parsedData = calcSMA(parsedData, 20, 'ma20');
      parsedData = calcSMA(parsedData, 50, 'ma50');
      parsedData = calcSMA(parsedData, 200, 'ma200');

      let finalDataset = timeframe === 'weekly' ? aggregateToWeekly(parsedData) : parsedData;
      setStockData(finalDataset);
      setZoomRange({ start: Math.max(0, finalDataset.length - 80), end: finalDataset.length });
    } catch (err) {
      setErrorMsg(err.message);
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedStock) fetchStockData(selectedStock); }, [selectedStock, timeframe]);

  // Handle Next / Prev Navigation
  const getCurrentList = () => {
    if (activeTab === 'all') return availableStocks.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    if (activeTab === 'screener') return screenerResults;
    return watchlists[currentWatchlist] || [];
  };

  const navigateStock = (direction) => {
    const list = getCurrentList();
    if (!list || list.length === 0) return;
    const idx = list.indexOf(selectedStock);
    if (direction === 'next' && idx < list.length - 1) setSelectedStock(list[idx + 1]);
    if (direction === 'prev' && idx > 0) setSelectedStock(list[idx - 1]);
  };

  // Dummy mobile local screener (simulated for UI)
  const runLocalScreener = async (type) => {
    setIsScreening(true);
    setActiveScreener(type);
    // In a real scenario, this fetches screeners.json from GitHub.
    // For now, we simulate finding some top stocks from available list.
    setTimeout(() => {
      const shuffled = [...availableStocks].sort(() => 0.5 - Math.random());
      setScreenerResults(shuffled.slice(0, 15));
      setIsScreening(false);
    }, 1000);
  };

  const filteredStocks = availableStocks.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  const StockCard = ({ stock }) => (
    <div 
      onClick={() => { setSelectedStock(stock); setView('chart'); }}
      className="bg-gray-900 border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-blue-500 flex justify-between items-center"
    >
      <div><h3 className="font-bold">{stock}</h3><p className="text-xs text-gray-400">NSE</p></div>
      <span className="text-xs px-2 py-1 bg-blue-950 text-blue-400 rounded">Chart</span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-400">GitHub Config</h3>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input type="text" value={githubUser} onChange={(e) => setGithubUser(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-3 text-sm text-white" />
            <label className="block text-xs text-gray-400 mb-1">Repository</label>
            <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 mb-3 text-sm text-white" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm bg-gray-800 rounded">Cancel</button>
              <button onClick={() => { localStorage.setItem('gh_user', githubUser); localStorage.setItem('gh_repo', githubRepo); setShowSettings(false); loadStockListFromRepo(); }} className="px-4 py-2 text-sm bg-blue-600 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {view === 'main' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <div>
              <h1 className="text-lg font-bold text-blue-400">EquiScreen Pro</h1>
              <p className="text-[10px] text-gray-400">{githubUser}/{githubRepo}</p>
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-800 rounded text-gray-300"><Settings className="w-4 h-4" /></button>
          </div>

          <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
            <button onClick={() => setActiveTab('all')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'all' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>All</button>
            <button onClick={() => setActiveTab('screener')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Screeners</button>
            <button onClick={() => setActiveTab('watchlist')} className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Watchlists</button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4 bg-gray-950">
            <div className="mb-3 shrink-0">
              {activeTab === 'all' && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" placeholder="Search stocks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500" />
                </div>
              )}
              {activeTab === 'screener' && (
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => runLocalScreener('52w')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs flex items-center border ${activeScreener === '52w' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700'}`}><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> 52W High Scan</button>
                  <button onClick={() => runLocalScreener('inside')} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs flex items-center border ${activeScreener === 'inside' ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700'}`}><Play className="w-3.5 h-3.5 mr-1.5" /> Inside Bar</button>
                </div>
              )}
              {activeTab === 'watchlist' && (
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {Object.keys(watchlists).map(list => (
                    <button key={list} onClick={() => setCurrentWatchlist(list)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs border ${currentWatchlist === list ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700'}`}><Folder className="w-3.5 h-3.5 inline mr-1" /> {list}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto flex-1 content-start pb-6">
              {fetchingStockList || isScreening ? (
                <div className="col-span-full py-12 text-center text-gray-400 text-sm flex flex-col items-center gap-2"><RefreshCw className="w-6 h-6 animate-spin text-blue-400" /> Loading...</div>
              ) : (
                (activeTab === 'all' ? filteredStocks : activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []).map(stock => (
                  <StockCard key={stock} stock={stock} />
                ))
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
              <div>
                <h2 className="text-base font-bold leading-tight">{selectedStock}</h2>
                <span className="text-[10px] text-gray-400 uppercase">{timeframe}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>W</button>
              </div>
              <div className="bg-gray-800 rounded p-1 flex hidden sm:flex">
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'candle' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Cnd</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'bar' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Bar</button>
              </div>
              <button onClick={() => setWatchlists(prev => ({...prev, 'My Favorites': prev['My Favorites'].includes(selectedStock) ? prev['My Favorites'] : [...prev['My Favorites'], selectedStock]}))} className="p-1.5 bg-gray-800 rounded text-blue-400 ml-1"><Plus className="w-4 h-4" /></button>
            </div>
          </header>

          <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-950 p-1">
            {/* Navigation Buttons Overlaid on Chart */}
            <button onClick={() => navigateStock('prev')} className="absolute left-2 top-1/2 z-30 p-2 bg-gray-900/60 hover:bg-gray-800 rounded-full border border-gray-700 transform -translate-y-1/2"><ArrowLeft className="w-5 h-5 text-gray-300" /></button>
            <button onClick={() => navigateStock('next')} className="absolute right-2 top-1/2 z-30 p-2 bg-gray-900/60 hover:bg-gray-800 rounded-full border border-gray-700 transform -translate-y-1/2"><ArrowRight className="w-5 h-5 text-gray-300" /></button>

            {loading && <div className="absolute inset-0 z-40 bg-gray-950/80 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}
            {errorMsg && !loading && <div className="flex-1 flex items-center justify-center p-6 text-center text-red-400 text-sm">{errorMsg}</div>}

            {!loading && !errorMsg && stockData.length > 0 && (
              <>
                <div className="absolute top-2 right-12 z-20 flex space-x-1 bg-gray-900/80 rounded p-1 border border-gray-700">
                  <button onClick={() => setZoomRange(prev => ({...prev, start: Math.min(prev.start + 15, prev.end - 10)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomIn className="w-4 h-4 text-gray-300"/></button>
                  <button onClick={() => setZoomRange(prev => ({...prev, start: Math.max(0, prev.start - 15)}))} className="p-1 hover:bg-gray-800 rounded"><ZoomOut className="w-4 h-4 text-gray-300"/></button>
                </div>

                <div className="flex-1 min-h-[250px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize: 9}} minTickGap={20} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7280" tick={{fontSize: 9}} orientation="right" width={40} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px'}} />
                      {chartType === 'candle' ? <Bar dataKey="close" shape={<Candlestick />} /> : <Line type="step" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />}
                      <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="ma20" stroke="#10b981" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey={timeframe === 'daily' ? "ma200" : "ma40"} stroke="#8b5cf6" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-20 shrink-0 mb-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#6b7280" tick={{fontSize: 9}} orientation="right" width={40} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px'}} />
                      <Bar dataKey="volume">
                        {stockData.slice(zoomRange.start, zoomRange.end).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? '#22c55e80' : '#ef444480'} />
                        ))}
                      </Bar>
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

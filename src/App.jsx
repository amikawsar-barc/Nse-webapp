import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, RefreshCw, Settings } from 'lucide-react';

// Custom Candlestick shape for Recharts
const Candlestick = (props) => {
  const { x, y, width, height, low, high, open, close } = props;
  if (!x || !y || !props.yAxis) return null;
  const isGrowing = close >= open;
  const color = isGrowing ? '#22c55e' : '#ef4444';
  const yTop = props.yAxis.scale(Math.max(open, close));
  const yBottom = props.yAxis.scale(Math.min(open, close));
  const yHigh = props.yAxis.scale(high);
  const yLow = props.yAxis.scale(low);
  
  return (
    <g stroke={color} fill={color} strokeWidth="1.5">
      <line x1={x + width / 2} y1={yHigh} x2={x + width / 2} y2={yTop} />
      <line x1={x + width / 2} y1={yBottom} x2={x + width / 2} y2={yLow} />
      <rect x={x} y={yTop} width={width} height={Math.max(yBottom - yTop, 1)} />
    </g>
  );
};

export default function App() {
  // Configuration for GitHub Repository
  const [githubUser, setGithubUser] = useState(localStorage.getItem('gh_user') || 'YOUR_GITHUB_USERNAME');
  const [githubRepo, setGithubRepo] = useState(localStorage.getItem('gh_repo') || 'YOUR_REPO_NAME');
  const [showSettings, setShowSettings] = useState(false);

  const [view, setView] = useState('main'); // 'main' or 'chart'
  const [activeTab, setActiveTab] = useState('screener'); // 'screener' or 'watchlist'
  const [selectedStock, setSelectedStock] = useState(null);
  
  const [timeframe, setTimeframe] = useState('daily'); // 'daily' or 'weekly'
  const [chartType, setChartType] = useState('candle'); // 'candle' or 'bar'
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [watchlists, setWatchlists] = useState(() => {
    const saved = localStorage.getItem('equiscreen_watchlists');
    return saved ? JSON.parse(saved) : {
      'My Favorites': ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'],
      'Breakout Candidates': ['ICICIBANK', 'BHARTIARTL', 'SBIN']
    };
  });
  const [currentWatchlist, setCurrentWatchlist] = useState('My Favorites');

  // Screener Stocks
  const defaultStocks = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HUL', 'ITC', 'SBIN', 'BHARTIARTL', 'BAJFINANCE'];
  const [screenerResults, setScreenerResults] = useState(defaultStocks);

  useEffect(() => {
    localStorage.setItem('equiscreen_watchlists', JSON.stringify(watchlists));
  }, [watchlists]);

  // Aggregate daily data to weekly OHLC
  const aggregateToWeekly = (dailyData) => {
    if (!dailyData || dailyData.length === 0) return [];
    
    let weekly = [];
    let currentWeek = null;

    dailyData.forEach((day) => {
      const dateObj = new Date(day.date);
      // Determine week key (Year and ISO Week number)
      const jan1 = new Date(dateObj.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((dateObj - jan1) / 86400000) + jan1.getDay() + 1) / 7);
      const weekKey = `${dateObj.getFullYear()}-W${weekNum}`;

      if (!currentWeek || currentWeek.weekKey !== weekKey) {
        if (currentWeek) {
          weekly.push(currentWeek);
        }
        currentWeek = {
          weekKey,
          date: day.date,
          open: day.open,
          high: day.high,
          low: day.low,
          close: day.close,
          volume: day.volume
        };
      } else {
        currentWeek.high = Math.max(currentWeek.high, day.high);
        currentWeek.low = Math.min(currentWeek.low, day.low);
        currentWeek.close = day.close;
        currentWeek.volume += day.volume;
        currentWeek.date = day.date; // Use latest date in week
      }
    });

    if (currentWeek) weekly.push(currentWeek);

    // Calculate Moving Averages for Weekly (10, 20, 40)
    const calculateWeeklySMA = (data, period, key) => {
      return data.map((item, idx) => {
        if (idx < period - 1) return { ...item, [key]: null };
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[idx - i].close;
        return { ...item, [key]: sum / period };
      });
    };

    weekly = calculateWeeklySMA(weekly, 10, 'ma10');
    weekly = calculateWeeklySMA(weekly, 20, 'ma20');
    weekly = calculateWeeklySMA(weekly, 40, 'ma40');

    return weekly;
  };

  // Fetch real data from GitHub Raw CDN
  const fetchStockData = async (symbol) => {
    setLoading(true);
    setErrorMsg(null);
    const cleanSymbol = symbol.trim().toUpperCase();
    const url = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/main/data/${cleanSymbol}_data.csv`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Data for ${cleanSymbol} not found on GitHub. Make sure repository is set up.`);
      }
      
      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      if (lines.length <= 1) throw new Error(`Empty CSV file for ${cleanSymbol}`);
      
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
        const volume = parseInt(row[volIdx]) || 0;

        if (!isNaN(close)) {
          parsedData.push({ date, open, high, low, close, volume });
        }
      }

      if (parsedData.length === 0) throw new Error(`No valid numerical data in CSV for ${cleanSymbol}`);

      // Calculate Daily Simple Moving Averages (10, 20, 50, 200)
      const calculateSMA = (data, period, key) => {
        return data.map((item, index) => {
          if (index < period - 1) return { ...item, [key]: null };
          let sum = 0;
          for (let i = 0; i < period; i++) sum += data[index - i].close;
          return { ...item, [key]: sum / period };
        });
      };

      parsedData = calculateSMA(parsedData, 10, 'ma10');
      parsedData = calculateSMA(parsedData, 20, 'ma20');
      parsedData = calculateSMA(parsedData, 50, 'ma50');
      parsedData = calculateSMA(parsedData, 200, 'ma200');

      let finalDataset = parsedData;
      if (timeframe === 'weekly') {
        finalDataset = aggregateToWeekly(parsedData);
      }

      setStockData(finalDataset);
      setZoomRange({ start: Math.max(0, finalDataset.length - 80), end: finalDataset.length });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStock) {
      fetchStockData(selectedStock);
    }
  }, [selectedStock, timeframe]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (view !== 'chart') return;
    const listToUse = activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist];
    if (!listToUse) return;
    
    const currentIndex = listToUse.indexOf(selectedStock);
    if (e.key === 'ArrowRight' && currentIndex < listToUse.length - 1) {
      setSelectedStock(listToUse[currentIndex + 1]);
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      setSelectedStock(listToUse[currentIndex - 1]);
    }
  }, [view, selectedStock, activeTab, screenerResults, watchlists, currentWatchlist]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const addToWatchlist = (stock, listName) => {
    setWatchlists(prev => ({
      ...prev,
      [listName]: prev[listName].includes(stock) ? prev[listName] : [...prev[listName], stock]
    }));
  };

  const saveSettings = () => {
    localStorage.setItem('gh_user', githubUser);
    localStorage.setItem('gh_repo', githubRepo);
    setShowSettings(false);
    if (selectedStock) fetchStockData(selectedStock);
  };

  const runScreener = (type) => {
    if (type === '52w') {
      setScreenerResults(['RELIANCE', 'TCS', 'BHARTIARTL', 'ICICIBANK', 'HDFCBANK']);
    } else if (type === 'insideBar') {
      setScreenerResults(['INFY', 'SBIN', 'ITC', 'HUL']);
    } else {
      setScreenerResults(defaultStocks);
    }
  };

  const StockCard = ({ stock }) => (
    <div 
      onClick={() => { setSelectedStock(stock); setView('chart'); }}
      className="bg-gray-900 border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-blue-500 transition-colors flex justify-between items-center"
    >
      <div>
        <h3 className="font-bold text-base">{stock}</h3>
        <p className="text-xs text-gray-400">NSE EQ</p>
      </div>
      <span className="text-xs px-2 py-1 bg-blue-950 text-blue-400 border border-blue-800 rounded">View Chart</span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-blue-400">GitHub Repository Source</h3>
            <label className="block text-xs text-gray-400 mb-1">GitHub Username</label>
            <input 
              type="text" 
              value={githubUser} 
              onChange={(e) => setGithubUser(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white mb-4"
              placeholder="e.g. amikaw"
            />
            <label className="block text-xs text-gray-400 mb-1">Repository Name</label>
            <input 
              type="text" 
              value={githubRepo} 
              onChange={(e) => setGithubRepo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white mb-6"
              placeholder="e.g. nse-data-tracker"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded">Cancel</button>
              <button onClick={saveSettings} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded font-medium">Save & Apply</button>
            </div>
          </div>
        </div>
      )}

      {view === 'main' && (
        <>
          {/* Main Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <h1 className="text-lg font-bold text-blue-400">EquiScreen Pro</h1>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Top Horizontal Tabs */}
          <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
            <button
              onClick={() => setActiveTab('screener')}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Screeners
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/40' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Watchlists
            </button>
          </div>

          {/* Tab View Container */}
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-950 p-4">
            
            {/* Horizontal Filter Buttons */}
            <div className="flex gap-2 overflow-x-auto pb-3 shrink-0 [&::-webkit-scrollbar]:hidden">
              {activeTab === 'screener' ? (
                <>
                  <button onClick={() => runScreener('all')} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-xs font-medium flex items-center border border-gray-700 hover:bg-gray-700">
                    All Stocks
                  </button>
                  <button onClick={() => runScreener('52w')} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-xs font-medium flex items-center border border-gray-700 hover:bg-gray-700">
                    <Search className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Near 52W High
                  </button>
                  <button onClick={() => runScreener('insideBar')} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-xs font-medium flex items-center border border-gray-700 hover:bg-gray-700">
                    <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-green-400" /> Weekly Inside Bar
                  </button>
                </>
              ) : (
                <>
                  {Object.keys(watchlists).map(list => (
                    <button key={list} onClick={() => setCurrentWatchlist(list)} className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium flex items-center border transition-colors ${currentWatchlist === list ? 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                      <Folder className="w-3.5 h-3.5 mr-1.5" /> {list}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 content-start pb-6">
              {(activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []).map(stock => (
                <StockCard key={stock} stock={stock} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Chart View */}
      {view === 'chart' && (
        <div className="flex flex-col h-full relative">
          
          {/* Header */}
          <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0 z-20">
            <div className="flex items-center">
              <button onClick={() => { setView('main'); setSelectedStock(null); }} className="p-2 mr-1 hover:bg-gray-800 rounded-full">
                <ArrowLeft className="w-5 h-5 text-gray-300" />
              </button>
              <div>
                <h2 className="text-base font-bold leading-tight">{selectedStock}</h2>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{timeframe}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded font-semibold ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>W</button>
              </div>
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'candle' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Cndl</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded font-semibold ${chartType === 'bar' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Bar</button>
              </div>
              <button onClick={() => addToWatchlist(selectedStock, 'My Favorites')} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-blue-400">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-950 p-2">
            
            {/* Loading Indicator */}
            {loading && (
              <div className="absolute inset-0 z-30 bg-gray-950/80 backdrop-blur flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-sm text-gray-300">Fetching CSV from GitHub...</p>
                </div>
              </div>
            )}

            {/* Error View */}
            {errorMsg && !loading && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-blue-400">
                  Check Repo Settings
                </button>
              </div>
            )}

            {!loading && !errorMsg && stockData.length > 0 && (
              <>
                {/* Floating Zoom Controls */}
                <div className="absolute top-4 right-4 z-10 flex space-x-1 bg-gray-900/80 backdrop-blur rounded p-1 border border-gray-700">
                  <button onClick={() => setZoomRange(prev => ({...prev, start: Math.min(prev.start + 15, prev.end - 10)}))} className="p-1.5 hover:bg-gray-800 rounded">
                    <ZoomIn className="w-4 h-4 text-gray-300"/>
                  </button>
                  <button onClick={() => setZoomRange(prev => ({...prev, start: Math.max(0, prev.start - 15)}))} className="p-1.5 hover:bg-gray-800 rounded">
                    <ZoomOut className="w-4 h-4 text-gray-300"/>
                  </button>
                </div>

                {/* Main Price Chart */}
                <div className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize: 10}} minTickGap={20} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7280" tick={{fontSize: 10}} orientation="right" width={45} />
                      <Tooltip contentStyle={{backgroundColor: '#111827', borderColor: '#374151', fontSize: '11px'}} />
                      
                      {chartType === 'candle' ? (
                        <Bar dataKey="close" shape={<Candlestick />} />
                      ) : (
                        <Line type="step" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      )}

                      {/* Moving Averages */}
                      <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="ma20" stroke="#10b981" dot={false} strokeWidth={1} />
                      <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} />
                      {timeframe === 'daily' ? (
                        <Line type="monotone" dataKey="ma200" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                      ) : (
                        <Line type="monotone" dataKey="ma40" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Sub Volume Chart */}
                <div className="h-24 shrink-0 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#6b7280" tick={{fontSize: 10}} orientation="right" width={45} />
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

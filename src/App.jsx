import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell, ReferenceLine } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft, ArrowRight, RefreshCw, Settings, SlidersHorizontal, Play, BarChart2, Star, Sun, Moon, ArrowUpDown, Edit2, Trash2, Check, X } from 'lucide-react';

const formatIndianNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  if (val >= 10000000) return (val / 10000000).toFixed(1) + 'Cr';
  if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toString();
};

const formatMarketCap = (val) => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return 'N/A';
  if (val >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
  if (val >= 100000) return (val / 100000).toFixed(2) + ' L';
  return val.toFixed(0);
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

  // Sorting state
  const [sortOrder, setSortOrder] = useState('mcap_desc'); // 'mcap_desc', 'mcap_asc', 'alpha_asc'

  const [screenerParams, setScreenerParams] = useState(() => {
    const saved = localStorage.getItem('equiscreen_params');
    return saved ? JSON.parse(saved) : { highPct: 25, lowPct: 50, insideBarCount: 1, minMarketCap: 0, maxMarketCap: 0 };
  });

  const [watchlists, setWatchlists] = useState(() => {
    const saved = localStorage.getItem('equiscreen_watchlists');
    return saved ? JSON.parse(saved) : { 'My Favorites': [{ symbol: 'RELIANCE', mcap: 19000000000000 }, { symbol: 'TCS', mcap: 14000000000000 }] };
  });
  const [currentWatchlist, setCurrentWatchlist] = useState('My Favorites');

  // Touch state for swipe and pinch-to-zoom
  const [touchStart, setTouchStart] = useState({ x: 0, dist: 0 });

  // Panel resizing
  const [priceChartPct, setPriceChartPct] = useState(70);
  const [isResizing, setIsResizing] = useState(false);
  
  // Crosshair
  const [crosshairVal, setCrosshairVal] = useState(null);

  // Watchlist Management
  const [showWatchlistPrompt, setShowWatchlistPrompt] = useState(null); // 'add' | 'rename'
  const [promptInput, setPromptInput] = useState('');


  useEffect(() => { localStorage.setItem('equiscreen_watchlists', JSON.stringify(watchlists)); }, [watchlists]);
  useEffect(() => { localStorage.setItem('equiscreen_params', JSON.stringify(screenerParams)); }, [screenerParams]);

  const loadStockListFromRepo = async () => {
    setFetchingStockList(true);
    try {
      // 1. Fetch Market Cap mapping JSON
      let mcapMap = {};
      try {
        let mcapRes = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/data/market_caps.json`);
        if (!mcapRes.ok) {
          const altBranch = githubBranch === 'main' ? 'master' : 'main';
          mcapRes = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/data/market_caps.json`);
        }
        if (mcapRes.ok) {
          const rawMcapMap = await mcapRes.json();
          // Normalize keys to uppercase for matching
          Object.keys(rawMcapMap).forEach(k => {
            mcapMap[k.trim().toUpperCase()] = parseFloat(rawMcapMap[k]) || 0;
          });
        }
      } catch (mcapErr) {
        console.warn("Could not load market_cap.json", mcapErr);
      }

      // 2. Fetch Stock Symbol list CSV
      let response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/EQUITY_L.csv`);
      if (!response.ok) {
        const altBranch = githubBranch === 'main' ? 'master' : 'main';
        response = await fetch(`https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${altBranch}/EQUITY_L.csv`);
        if (response.ok) setGithubBranch(altBranch);
      }
      const text = await response.text();
      const lines = text.trim().replace(/\r/g, '').split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toUpperCase());
        const symbolIdx = headers.findIndex(h => h === 'SYMBOL');
        const mcapIdx = headers.findIndex(h => h.includes('MARKET CAP') || h.includes('MCAP') || h.includes('MARKET_CAP') || h.includes('CAPITALISATION'));

        let stocks = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
          if (symbolIdx !== -1 && cols[symbolIdx]) {
            const sym = cols[symbolIdx].toUpperCase();
            let mcap = mcapMap[sym] || 0;
            
            // Fallback to CSV header if missing in JSON
            if (mcap === 0 && mcapIdx !== -1 && cols[mcapIdx]) {
              mcap = parseFloat(cols[mcapIdx]) || 0;
            }
            stocks.push({ symbol: sym, mcap });
          }
        }
        if (stocks.length > 0) setAvailableStocks(stocks);
      }
    } catch (err) {
      setAvailableStocks([
        { symbol: 'RELIANCE', mcap: 19000000000000 },
        { symbol: 'TCS', mcap: 14000000000000 },
        { symbol: 'HDFCBANK', mcap: 11000000000000 },
        { symbol: 'INFY', mcap: 6500000000000 },
        { symbol: 'ICICIBANK', mcap: 7500000000000 },
        { symbol: 'ITC', mcap: 5500000000000 },
        { symbol: 'SBIN', mcap: 7000000000000 }
      ]);
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

  const fetchStockData = async (stockItem) => {
    setLoading(true); setErrorMsg(null);
    const cleanSymbol = (typeof stockItem === 'string' ? stockItem : stockItem.symbol).trim().toUpperCase();
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
      parsedData = calcDailySMA(parsedData, 20, 'ma50');
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
        const batchPromises = batch.map(async (stockItem) => {
            const sym = typeof stockItem === 'string' ? stockItem : stockItem.symbol;
            const currentMcap = (typeof stockItem === 'object' && stockItem.mcap) ? stockItem.mcap : 0;

            // Apply Lower & Upper Market Cap filter checks across all screeners
            const minMcapCr = screenerParams.minMarketCap || 0;
            const maxMcapCr = screenerParams.maxMarketCap || 0;
            const minMcapVal = minMcapCr * 10000000; // Cr -> Rupees
            const maxMcapVal = maxMcapCr * 10000000; // Cr -> Rupees

            if (minMcapCr > 0 && currentMcap < minMcapVal) {
                return null;
            }
            if (maxMcapCr > 0 && currentMcap > maxMcapVal) {
                return null;
            }

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
                        
                        const recentData = lines.slice(-250);
                        const lastRow = recentData[recentData.length - 1].split(',');
                        const currentClose = parseFloat(lastRow[closeIdx]);

                        if (type === 'insideBar') {
                            const recentDataLines = lines.slice(-60); 
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
                            const n = screenerParams.insideBarCount || 1;
                            
                            if (weekly.length >= n + 1) {
                                let isMatch = true;
                                for (let j = 0; j < n; j++) {
                                    const currentWeek = weekly[weekly.length - 1 - j];
                                    const prevWeek = weekly[weekly.length - 2 - j];
                                    
                                    if (!(currentWeek.high < prevWeek.high && currentWeek.low > prevWeek.low)) {
                                        isMatch = false;
                                        break;
                                    }
                                }
                                if (isMatch) return { symbol: sym, mcap: currentMcap, close: currentClose };
                            }
                            return null;
                        }

                        let max52w = 0, min52w = 999999;
                        recentData.forEach(rowStr => {
                            const r = rowStr.split(',');
                            const h = parseFloat(r[highIdx]); const l = parseFloat(r[lowIdx]);
                            if (h > max52w) max52w = h;
                            if (l < min52w) min52w = l;
                        });

                        const minHighThreshold = max52w * (1 - screenerParams.highPct / 100);
                        const minLowThreshold = min52w * (1 + screenerParams.lowPct / 100);

                        if (type === '52wHigh' && currentClose >= minHighThreshold) return { symbol: sym, mcap: currentMcap, close: currentClose };
                        if (type === '52wLow' && currentClose >= minLowThreshold) return { symbol: sym, mcap: currentMcap, close: currentClose };
                        if (type === 'combined' && currentClose >= minHighThreshold && currentClose >= minLowThreshold) return { symbol: sym, mcap: currentMcap, close: currentClose };
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

  const getSortedList = (list) => {
    if (!list || list.length === 0) return [];
    return [...list].sort((a, b) => {
      const itemA = typeof a === 'string' ? { symbol: a, mcap: 0 } : a;
      const itemB = typeof b === 'string' ? { symbol: b, mcap: 0 } : b;
      
      const mcapA = Number(itemA.mcap) || 0;
      const mcapB = Number(itemB.mcap) || 0;
      const symA = (itemA.symbol || '').toString();
      const symB = (itemB.symbol || '').toString();

      if (sortOrder === 'mcap_desc') return mcapB - mcapA;
      if (sortOrder === 'mcap_asc') return mcapA - mcapB;
      if (sortOrder === 'alpha_asc') return symA.localeCompare(symB);
      return 0;
    });
  };

  const navigateStock = (dir) => {
    const rawList = activeTab === 'screener' ? screenerResults : (activeTab === 'all' ? availableStocks : watchlists[currentWatchlist] || []);
    const list = getSortedList(rawList);
    const currentSym = typeof selectedStock === 'string' ? selectedStock : selectedStock?.symbol;
    const idx = list.findIndex(s => (typeof s === 'string' ? s : s.symbol) === currentSym);
    
    if (dir === 'next' && idx < list.length - 1) setSelectedStock(list[idx + 1]);
    if (dir === 'prev' && idx > 0) setSelectedStock(list[idx - 1]);
  };

  const toggleWatchlist = () => {
    const list = watchlists[currentWatchlist] || [];
    const currentSym = typeof selectedStock === 'string' ? selectedStock : selectedStock?.symbol;
    const exists = list.some(s => (typeof s === 'string' ? s : s.symbol) === currentSym);
    
    if (exists) {
      setWatchlists({...watchlists, [currentWatchlist]: list.filter(s => (typeof s === 'string' ? s : s.symbol) !== currentSym)});
    } else {
      const itemToAdd = typeof selectedStock === 'object' ? selectedStock : { symbol: selectedStock, mcap: 0 };
      setWatchlists({...watchlists, [currentWatchlist]: [...list, itemToAdd]});
    }
  };

  // TOUCH EVENT HANDLERS
  
  // Panel Resizing Handlers
  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const container = document.getElementById('chart-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newPct = ((e.clientY - rect.top) / rect.height) * 100;
        if (newPct > 20 && newPct < 80) setPriceChartPct(newPct);
      }
    };
    const handleTouchMoveResizer = (e) => {
      if (!isResizing) return;
      const container = document.getElementById('chart-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newPct = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
        if (newPct > 20 && newPct < 80) setPriceChartPct(newPct);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMoveResizer);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMoveResizer);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  // Watchlist Management Handlers
  const handleCreateWatchlist = () => {
    if (promptInput.trim() && !watchlists[promptInput.trim()]) {
      setWatchlists({ ...watchlists, [promptInput.trim()]: [] });
      setCurrentWatchlist(promptInput.trim());
    }
    setShowWatchlistPrompt(null);
    setPromptInput('');
  };

  const handleRenameWatchlist = () => {
    if (promptInput.trim() && promptInput.trim() !== currentWatchlist && !watchlists[promptInput.trim()]) {
      const newWatchlists = { ...watchlists };
      newWatchlists[promptInput.trim()] = newWatchlists[currentWatchlist];
      delete newWatchlists[currentWatchlist];
      setWatchlists(newWatchlists);
      setCurrentWatchlist(promptInput.trim());
    }
    setShowWatchlistPrompt(null);
    setPromptInput('');
  };

  const handleDeleteWatchlist = () => {
    if (Object.keys(watchlists).length > 1) {
      const newWatchlists = { ...watchlists };
      delete newWatchlists[currentWatchlist];
      setWatchlists(newWatchlists);
      setCurrentWatchlist(Object.keys(newWatchlists)[0]);
    } else {
      alert("You must have at least one watchlist.");
    }
  };

  const removeFromWatchlist = (sym, e) => {
    e.stopPropagation();
    const list = watchlists[currentWatchlist] || [];
    setWatchlists({ ...watchlists, [currentWatchlist]: list.filter(s => (typeof s === 'string' ? s : s.symbol) !== sym) });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, dist: 0 });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStart({ x: 0, dist });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStart.dist > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = currentDist - touchStart.dist;
      
      if (Math.abs(diff) > 20) {
        if (diff > 0) {
          // Zoom In (Fingers expanding)
          setZoomRange(p => ({...p, start: Math.min(p.start + 5, p.end - 10)}));
        } else {
          // Zoom Out (Fingers squeezing)
          setZoomRange(p => ({...p, start: Math.max(0, p.start - 5)}));
        }
        setTouchStart(prev => ({ ...prev, dist: currentDist }));
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches.length === 1 && touchStart.x > 0) {
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStart.x - touchEndX;
      
      // Swipe left (next)
      if (diffX > 50) {
        navigateStock('next');
      } 
      // Swipe right (prev)
      else if (diffX < -50) {
        navigateStock('prev');
      }
      setTouchStart({ x: 0, dist: 0 });
    }
  };

  const currentSelectedSym = typeof selectedStock === 'string' ? selectedStock : selectedStock?.symbol;
  const isWatchlisted = (watchlists[currentWatchlist] || []).some(s => (typeof s === 'string' ? s : s.symbol) === currentSelectedSym);

  const displayedList = getSortedList(activeTab === 'all' ? availableStocks : activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist] || []);

  return (
    <div className={`flex flex-col h-[100dvh] w-full ${bgMain} font-sans overflow-hidden`}>
      
      
      {showWatchlistPrompt && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className={`${bgPanel} border ${borderCol} rounded p-6 w-full max-w-sm`}>
            <h3 className="text-lg font-bold mb-4">{showWatchlistPrompt === 'add' ? 'New Watchlist' : 'Rename Watchlist'}</h3>
            <input 
              type="text" 
              autoFocus
              value={promptInput} 
              onChange={e => setPromptInput(e.target.value)}
              placeholder="Watchlist Name"
              className={`w-full p-2 border ${borderCol} rounded ${bgMain} mb-4`} 
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowWatchlistPrompt(null)} className="px-4 py-2 rounded text-sm bg-gray-500 text-white">Cancel</button>
              <button onClick={showWatchlistPrompt === 'add' ? handleCreateWatchlist : handleRenameWatchlist} className="px-4 py-2 rounded text-sm bg-blue-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {showScreenerConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className={`${bgPanel} border ${borderCol} rounded p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto`}>
            <h3 className="text-lg font-bold mb-4 text-blue-500">Screener Parameters</h3>
            
            <label className={`block text-sm ${textMuted} mb-1`}>Min Market Cap (Cr)</label>
            <p className={`text-[11px] ${textMuted} mb-2`}>Lower limit across all screeners (0 = No min)</p>
            <div className="flex items-center gap-2 mb-4">
              <input 
                type="number" 
                min="0" 
                step="500"
                value={screenerParams.minMarketCap || 0} 
                onChange={(e) => setScreenerParams({...screenerParams, minMarketCap: Math.max(0, parseInt(e.target.value) || 0)})} 
                className={`flex-1 p-2 border ${borderCol} rounded ${bgMain} text-sm`} 
              />
              <span className="text-sm font-bold w-12 text-right">{screenerParams.minMarketCap || 0} Cr</span>
            </div>

            <label className={`block text-sm ${textMuted} mb-1`}>Max Market Cap (Cr)</label>
            <p className={`text-[11px] ${textMuted} mb-2`}>Upper limit across all screeners (0 = No max)</p>
            <div className="flex items-center gap-2 mb-4">
              <input 
                type="number" 
                min="0" 
                step="500"
                value={screenerParams.maxMarketCap || 0} 
                onChange={(e) => setScreenerParams({...screenerParams, maxMarketCap: Math.max(0, parseInt(e.target.value) || 0)})} 
                className={`flex-1 p-2 border ${borderCol} rounded ${bgMain} text-sm`} 
              />
              <span className="text-sm font-bold w-12 text-right">{screenerParams.maxMarketCap || 0} Cr</span>
            </div>

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

            <label className={`block text-sm ${textMuted} mb-1 mt-4`}>Consecutive Weekly Inside Bars</label>
            <p className={`text-[11px] ${textMuted} mb-2`}>Number of consecutive inside bars to screen for</p>
            <div className="flex items-center gap-2 mb-6">
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="1" 
                value={screenerParams.insideBarCount || 1} 
                onChange={(e) => setScreenerParams({...screenerParams, insideBarCount: parseInt(e.target.value)})} 
                className="flex-1" 
              />
              <span className="text-sm font-bold w-12 text-right">{screenerParams.insideBarCount || 1} Wk</span>
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
                  <button onClick={() => runLiveScan('insideBar')} className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs flex items-center border ${activeScreener === 'insideBar' ? 'bg-blue-900 border-blue-500 text-blue-300' : btnBg} shrink-0`}><BarChart2 className="w-3.5 h-3.5 mr-1" /> Weekly Inside Bar ({screenerParams.insideBarCount || 1}W)</button>
                </div>
              )}

              
              {/* SORT CONTROLS BAR */}
              <div className="flex justify-between items-center mt-2 px-1">
                {activeTab === 'watchlist' ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <select 
                      value={currentWatchlist} 
                      onChange={(e) => setCurrentWatchlist(e.target.value)}
                      className={`text-sm p-1 rounded border ${borderCol} ${bgPanel} font-bold focus:outline-none max-w-[150px] truncate`}
                    >
                      {Object.keys(watchlists).map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setPromptInput(''); setShowWatchlistPrompt('add'); }} className={`p-1.5 rounded border ${btnBg}`}><Plus className={`w-3.5 h-3.5 ${textMuted}`} /></button>
                      <button onClick={() => { setPromptInput(currentWatchlist); setShowWatchlistPrompt('rename'); }} className={`p-1.5 rounded border ${btnBg}`}><Edit2 className={`w-3.5 h-3.5 ${textMuted}`} /></button>
                      <button onClick={handleDeleteWatchlist} className={`p-1.5 rounded border ${btnBg}`}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={`text-[11px] ${textMuted}`}>
                      {screenerParams.minMarketCap > 0 || screenerParams.maxMarketCap > 0 
                        ? `MCap Range: ${screenerParams.minMarketCap || 0} - ${screenerParams.maxMarketCap ? screenerParams.maxMarketCap + 'Cr' : '∞'}`
                        : 'No MCap Range Limit'}
                    </span>
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className={`w-3.5 h-3.5 ${textMuted}`} />
                      <select 
                        value={sortOrder} 
                        onChange={(e) => setSortOrder(e.target.value)}
                        className={`text-xs p-1 rounded border ${borderCol} ${bgPanel} font-medium focus:outline-none`}
                      >
                        <option value="mcap_desc">MCap: High → Low</option>
                        <option value="mcap_asc">MCap: Low → High</option>
                        <option value="alpha_asc">Name: A → Z</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

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
                    {displayedList.map(stock => {
                      const sym = typeof stock === 'string' ? stock : stock.symbol;
                      const mcapVal = typeof stock === 'object' ? stock.mcap : 0;
                      return (
                        <div key={sym} onClick={() => { setSelectedStock(stock); setView('chart'); }} className={`${bgPanel} border ${borderCol} p-4 rounded-lg cursor-pointer hover:border-blue-500 flex justify-between items-center`}>
                          <div>
                            <h3 className="font-bold">{sym}</h3>
                            {mcapVal > 0 && <span className={`text-[11px] ${textMuted} block`}>MCap: {formatMarketCap(mcapVal)}</span>}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 ${isDark ? 'bg-blue-950 text-blue-400' : 'bg-blue-100 text-blue-700'} rounded`}>Chart</span>
                            {activeTab === 'watchlist' && (
                              <button onClick={(e) => removeFromWatchlist(sym, e)} className="p-1 rounded-full hover:bg-red-500/20 text-red-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })}
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
                <div>
                  <h2 className="text-base font-bold leading-tight">{currentSelectedSym}</h2>
                  <span className={`text-[10px] ${textMuted} uppercase`}>{timeframe}</span>
                </div>
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

          <main 
            className="w-full flex-1 flex flex-col relative shrink-0 p-1"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {loading && <div className={`absolute inset-0 z-40 ${isDark ? 'bg-gray-950/80' : 'bg-white/80'} flex items-center justify-center`}><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}
            
            {!loading && stockData.length > 0 && (
              <>
                <div className={`absolute top-2 left-2 z-20 flex space-x-1 ${bgPanel} bg-opacity-90 rounded p-1 border ${borderCol}`}>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.min(p.start + 15, p.end - 10)}))} className={`p-1 rounded ${btnBg}`}><ZoomIn className={`w-4 h-4 ${isDark ? 'text-white' : 'text-black'}`}/></button>
                  <button onClick={() => setZoomRange(p => ({...p, start: Math.max(0, p.start - 15)}))} className={`p-1 rounded ${btnBg}`}><ZoomOut className={`w-4 h-4 ${isDark ? 'text-white' : 'text-black'}`}/></button>
                </div>

                
                <div id="chart-container" className="flex-1 w-full pt-1 pb-1 flex flex-col relative select-none">
                  {/* Price Chart */}
                  <div style={{ height: `${priceChartPct}%` }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart 
                        data={stockData.slice(zoomRange.start, zoomRange.end)} 
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        onMouseMove={(e) => e && e.activePayload && setCrosshairVal(e.activePayload[0].payload)}
                        onMouseLeave={() => setCrosshairVal(null)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="date" stroke={axisText} tick={{fontSize: 9}} minTickGap={20} hide padding={{ right: 35 }} />
                        <YAxis domain={['auto', 'auto']} stroke={axisText} tick={{fontSize: 11, fill: tickColor, fontWeight: 'bold'}} orientation="right" width={55} />
                        <Tooltip cursor={{ stroke: textMuted, strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tickColor, fontSize: '11px'}} itemStyle={{color: tickColor}} />
                        <Bar dataKey="candleRange" shape={chartType === 'candle' ? <Candlestick /> : <OHLCBar />} />
                        <Line type="monotone" dataKey="ma10" stroke="#f59e0b" dot={false} strokeWidth={1} name="SMA 10" />
                        <Line type="monotone" dataKey="ma50" stroke="#ec4899" dot={false} strokeWidth={1.5} name="SMA 50" />
                        <Line type="monotone" dataKey={timeframe === 'daily' ? "ma200" : "ma40"} stroke="#8b5cf6" dot={false} strokeWidth={2} name={timeframe === 'daily' ? "SMA 200" : "SMA 40"} />
                        {crosshairVal && <ReferenceLine y={crosshairVal.close} stroke={textMuted} strokeDasharray="3 3" />}
                        {crosshairVal && <ReferenceLine x={crosshairVal.date} stroke={textMuted} strokeDasharray="3 3" />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Resizer */}
                  <div 
                    className={`h-2 w-full cursor-row-resize flex items-center justify-center ${isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-gray-500/50'} z-50`}
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                  >
                    <div className={`w-12 h-1 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                  </div>

                  {/* Volume Chart */}
                  <div style={{ height: `${100 - priceChartPct}%` }} className={`w-full pt-1`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart 
                        data={stockData.slice(zoomRange.start, zoomRange.end)} 
                        margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                        onMouseMove={(e) => e && e.activePayload && setCrosshairVal(e.activePayload[0].payload)}
                        onMouseLeave={() => setCrosshairVal(null)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="date" stroke={axisText} tick={{fontSize: 9}} minTickGap={20} padding={{ right: 35 }} />
                        <YAxis domain={[0, 'auto']} stroke={axisText} tick={{fontSize: 11, fill: tickColor, fontWeight: 'bold'}} tickFormatter={formatIndianNumber} orientation="right" width={55} />
                        <Tooltip cursor={{ stroke: textMuted, strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tickColor, fontSize: '11px'}} itemStyle={{color: tickColor}} formatter={(val) => [formatIndianNumber(val), "Volume"]} />
                        <Bar dataKey="volume" isAnimationActive={false}>
                          {stockData.slice(zoomRange.start, zoomRange.end).map((entry, index) => (
                            <Cell key={`vol-cell-${index}`} fill={entry.close >= entry.open ? '#22c55e' : '#ef4444'} opacity={0.65} />
                          ))}
                        </Bar>
                        <Line type="monotone" dataKey="vol_ma20" stroke="#f59e0b" dot={false} strokeWidth={1.2} name="Vol SMA 20" />
                        <Line type="monotone" dataKey="vol_ma50" stroke="#ec4899" dot={false} strokeWidth={1.2} name="Vol SMA 50" />
                        {crosshairVal && <ReferenceLine x={crosshairVal.date} stroke={textMuted} strokeDasharray="3 3" />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </>
            )}
          </main>

          {/* New Bottom Control Bar (Arrows + Market Cap) */}
          <footer className={`h-16 ${bgPanel} border-t ${borderCol} flex items-center justify-between px-6 shrink-0 z-20`}>
            <button 
              onClick={() => navigateStock('prev')} 
              className={`p-3 rounded-lg border ${btnBg} flex items-center justify-center`}
            >
              <ArrowLeft className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} />
            </button>
            
            <div className="flex flex-col items-center justify-center">
              <span className={`text-xs ${textMuted} uppercase tracking-wider`}>Market Cap</span>
              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                {selectedStock && selectedStock.mcap > 0 ? formatMarketCap(selectedStock.mcap) : 'N/A'}
              </span>
            </div>

            <button 
              onClick={() => navigateStock('next')} 
              className={`p-3 rounded-lg border ${btnBg} flex items-center justify-center`}
            >
              <ArrowRight className={`w-6 h-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} />
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

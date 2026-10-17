import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Cell } from 'recharts';
import { Search, TrendingUp, ZoomIn, ZoomOut, Plus, Folder, ArrowLeft } from 'lucide-react';

const Candlestick = (props) => {
  const { x, y, width, height, low, high, open, close } = props;
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
  const [view, setView] = useState('main'); 
  const [activeTab, setActiveTab] = useState('screener'); 
  const [selectedStock, setSelectedStock] = useState(null);
  const [timeframe, setTimeframe] = useState('daily');
  const [chartType, setChartType] = useState('candle');
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const [stockData, setStockData] = useState([]);
  
  const [watchlists, setWatchlists] = useState({
    'My Favorites': ['RELIANCE', 'TCS', 'HDFCBANK'],
    'Tech Stocks': ['INFY', 'WIPRO', 'HCLTECH']
  });
  const [currentWatchlist, setCurrentWatchlist] = useState('My Favorites');
  
  const allStocks = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HUL', 'ITC', 'SBIN', 'BHARTIARTL', 'BAJFINANCE'];
  const [screenerResults, setScreenerResults] = useState(allStocks);

  const fetchStockData = async (symbol) => {
    const url = `https://raw.githubusercontent.com/amikawsar-bar/nse-stock-track/main/data/${symbol}_data.csv`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Data not found");
     
      const csvText = await response.text();
      const rows = csvText.trim().split('\n').slice(1); // Skip header
     
      let data = rows.map(row => {
        const [date, open, high, low, close, volume] = row.split(',');
        return {
          date: date.split(' ')[0], // Extract just the YYYY-MM-DD
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseInt(volume),
          // Set placeholder 0s for MAs; we will calculate them below
          ma10: 0, ma20: 0, ma50: 0, ma200: 0
        };
      }).filter(item => !isNaN(item.close)); // Remove any invalid rows

      // Calculate Simple Moving Averages
      const calculateSMA = (data, period) => {
        return data.map((item, index) => {
          if (index < period - 1) return { ...item }; // Not enough data yet
          let sum = 0;
          for (let i = 0; i < period; i++) sum += data[index - i].close;
          return { ...item, [`ma${period}`]: sum / period };
        });
      };

      data = calculateSMA(data, 10);
      data = calculateSMA(data, 20);
      data = calculateSMA(data, 50);
      data = calculateSMA(data, 200);

      setStockData(data);
      // Zoom into the most recent 100 days by default
      setZoomRange({ start: Math.max(0, data.length - 100), end: data.length });
     
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      setStockData([]); // Clear chart if data fails
    }
  };

  useEffect(() => { if (selectedStock) fetchStockData(selectedStock); }, [selectedStock, timeframe]);

  const addToWatchlist = (stock, listName) => {
    setWatchlists(prev => ({
      ...prev, [listName]: prev[listName].includes(stock) ? prev[listName] : [...prev[listName], stock]
    }));
  };

  const runScreener = (type) => {
    if (type === '52w') setScreenerResults([...allStocks].reverse().slice(0, 5));
    else if (type === 'insideBar') setScreenerResults([allStocks[0], allStocks[3], allStocks[7]]);
  };

  const StockCard = ({ stock }) => (
    <div 
      onClick={() => { setSelectedStock(stock); setView('chart'); }}
      className="bg-gray-900 border border-gray-800 p-4 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-bold text-base">{stock}</h3>
        <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400">EQ</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {view === 'main' && (
        <>
          <div className="flex bg-gray-900 border-b border-gray-800 shrink-0 mt-4">
            <button onClick={() => setActiveTab('screener')} className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'screener' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}>Screeners</button>
            <button onClick={() => setActiveTab('watchlist')} className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'watchlist' ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}>Watchlists</button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col bg-gray-950 p-4">
            <div className="flex gap-2 overflow-x-auto pb-4 shrink-0 [&::-webkit-scrollbar]:hidden">
              {activeTab === 'screener' ? (
                <>
                  <button onClick={() => runScreener('52w')} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-sm flex items-center border border-gray-700 hover:bg-gray-700"><Search className="w-4 h-4 mr-2 text-blue-400" /> 52W High & >200SMA</button>
                  <button onClick={() => runScreener('insideBar')} className="whitespace-nowrap px-4 py-2 bg-gray-800 rounded-full text-sm flex items-center border border-gray-700 hover:bg-gray-700"><TrendingUp className="w-4 h-4 mr-2 text-blue-400" /> Weekly Inside Bar</button>
                </>
              ) : (
                <>
                  {Object.keys(watchlists).map(list => (
                    <button key={list} onClick={() => setCurrentWatchlist(list)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm flex items-center border transition-colors ${currentWatchlist === list ? 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}><Folder className="w-4 h-4 mr-2" /> {list}</button>
                  ))}
                </>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 content-start pb-6">
              {(activeTab === 'screener' ? screenerResults : watchlists[currentWatchlist]).map(stock => (
                <StockCard key={stock} stock={stock} />
              ))}
            </div>
          </div>
        </>
      )}
      {view === 'chart' && stockData.length > 0 && (
        <div className="flex flex-col h-full relative">
          <header className="h-auto min-h-[60px] py-2 mt-4 bg-gray-900 border-b border-gray-800 flex flex-wrap items-center justify-between px-3 gap-y-2 shrink-0 z-20">
            <div className="flex items-center">
              <button onClick={() => { setView('main'); setSelectedStock(null); }} className="p-2 mr-1 hover:bg-gray-800 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-gray-300" /></button>
              <h2 className="text-lg font-bold tracking-wide">{selectedStock}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setTimeframe('daily')} className={`px-2 py-1 text-xs rounded font-medium ${timeframe === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>D</button>
                <button onClick={() => setTimeframe('weekly')} className={`px-2 py-1 text-xs rounded font-medium ${timeframe === 'weekly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>W</button>
              </div>
              <div className="bg-gray-800 rounded p-1 flex">
                <button onClick={() => setChartType('candle')} className={`px-2 py-1 text-xs rounded font-medium ${chartType === 'candle' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Cndl</button>
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 text-xs rounded font-medium ${chartType === 'bar' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>Bar</button>
              </div>
              <button onClick={() => addToWatchlist(selectedStock, 'My Favorites')} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-blue-400 transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </header>
          <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-950 p-2 sm:p-4">
            <div className="absolute top-4 right-4 z-10 flex space-x-2 bg-gray-900/80 backdrop-blur rounded-lg p-1 border border-gray-700">
              <button onClick={() => setZoomRange(prev => ({...prev, start: Math.min(prev.start + 20, prev.end - 10)}))} className="p-1.5 hover:bg-gray-800 rounded"><ZoomIn className="w-5 h-5 text-gray-300"/></button>
              <button onClick={() => setZoomRange(prev => ({...prev, start: Math.max(0, prev.start - 20)}))} className="p-1.5 hover:bg-gray-800 rounded"><ZoomOut className="w-5 h-5 text-gray-300"/></button>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="date" stroke="#9CA3AF" tick={{fontSize: 10}} minTickGap={20} />
                  <YAxis domain={['auto', 'auto']} stroke="#9CA3AF" tick={{fontSize: 10}} orientation="right" width={45} />
                  <Tooltip contentStyle={{backgroundColor: '#1F2937', borderColor: '#374151', fontSize: '12px'}} />
                  {chartType === 'candle' ? <Bar dataKey="close" shape={<Candlestick />} /> : <Line type="step" dataKey="close" stroke="#60A5FA" dot={false} strokeWidth={2} />}
                  <Line type="monotone" dataKey="ma10" stroke="#F59E0B" dot={false} strokeWidth={1} />
                  <Line type="monotone" dataKey="ma50" stroke="#EC4899" dot={false} strokeWidth={1.5} />
                  {timeframe === 'daily' && <Line type="monotone" dataKey="ma200" stroke="#8B5CF6" dot={false} strokeWidth={2} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="h-24 sm:h-32 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stockData.slice(zoomRange.start, zoomRange.end)}>
                  <XAxis dataKey="date" hide />
                  <YAxis stroke="#9CA3AF" tick={{fontSize: 10}} orientation="right" width={45} />
                  <Tooltip contentStyle={{backgroundColor: '#1F2937', borderColor: '#374151', fontSize: '12px'}} />
                  <Bar dataKey="volume">
                    {stockData.slice(zoomRange.start, zoomRange.end).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? '#22c55e80' : '#ef444480'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

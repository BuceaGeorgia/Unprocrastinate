import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar,LabelList, Text } from 'recharts';
import './popup.css';

const TOTAL_TIME = 4 * 60 * 60; // 4 hours in seconds
const TOTAL_TIME_AVAILABLE = 86400;

function Popup() {
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [firstStartTime, setFirstStartTime] = useState(null);
  const [totalStopTime, setTotalStopTime] = useState(0);
  const [lastStopTime, setLastStopTime] = useState(null);
  const [stopUpdateInterval, setStopUpdateInterval] = useState(null);
  
  useEffect(() => {
    // Initialize state from storage
    chrome.storage.local.get(['timeLeft', 'isRunning', 'firstStartTime', 'totalStopTime', 'lastStopTime'], (result) => {
      if (result.timeLeft !== undefined) {
        setTimeLeft(result.timeLeft);
      }
      if (result.isRunning) {
        setIsRunning(true);
      }
      const id = startDisplayUpdate();
      setIntervalId(id);
      if (result.firstStartTime) {
        // Check if the stored firstStartTime is from today
        const storedDate = new Date(result.firstStartTime);
        const today = new Date();
        if (storedDate.toDateString() === today.toDateString()) {
          setFirstStartTime(result.firstStartTime);
          setTotalStopTime(result.totalStopTime || 0);
          setLastStopTime(result.lastStopTime);
        }
      }
    });

    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startDisplayUpdate = () => {
    const interval = setInterval(() => {
      chrome.storage.local.get([
        'timeLeft',
        'isRunning',
        'firstStartTime',
        'totalStopTime',
        'lastStopTime'
      ], (result) => {
        if (result.timeLeft !== undefined) {
          setTimeLeft(result.timeLeft);
          setFirstStartTime(result.firstStartTime);
          
          // Check if we've reached the limit before updating totalStopTime
          if (result.totalStopTime >= TOTAL_TIME_AVAILABLE) {
            setTotalStopTime(TOTAL_TIME_AVAILABLE);
            if (stopUpdateInterval) {
              clearInterval(stopUpdateInterval);
              setStopUpdateInterval(null);
            }
          } else {
            setTotalStopTime(result.totalStopTime);
            setLastStopTime(result.lastStopTime);
            
            // Only start updating if we haven't reached the limit
            if (!result.isRunning && result.lastStopTime && !stopUpdateInterval) {
              const newStopInterval = setInterval(() => {
                const now = Math.floor(new Date().getTime() / 1000);
                const currentStopTime = now - result.lastStopTime;
                const newTotalStopTime = result.totalStopTime + currentStopTime;
                
                if (newTotalStopTime >= TOTAL_TIME_AVAILABLE) {
                  setTotalStopTime(TOTAL_TIME_AVAILABLE);
                  clearInterval(newStopInterval);
                  setStopUpdateInterval(null);
                  chrome.storage.local.set({ 
                    totalStopTime: TOTAL_TIME_AVAILABLE,
                    lastStopTime: null
                  });
                } else {
                  setTotalStopTime(newTotalStopTime);
                }
              }, 1000);
              setStopUpdateInterval(newStopInterval);
            }
          }

          if (result.timeLeft <= 0 || !result.isRunning) {
            clearInterval(interval);
            setIsRunning(false);
          }
        }
      });
    }, 1000);

    return interval;
  };

  const stopDisplayUpdate = (intervalId) => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    if (stopUpdateInterval) {
      clearInterval(stopUpdateInterval);
      setStopUpdateInterval(null);
    }
  };

  const handleStart = () => {
    const now = Math.floor(new Date().getTime() / 1000);
    
    // If this is the first start of the day
    if (!firstStartTime) {
      setFirstStartTime(now);
      chrome.storage.local.set({ firstStartTime: now });
    }
    
    // Clear the stop update interval but keep the totalStopTime value
    if (stopUpdateInterval) {
      clearInterval(stopUpdateInterval);
      setStopUpdateInterval(null);
    }

    setIsRunning(true);
    setLastStopTime(null);
    chrome.runtime.sendMessage({ action: 'startTimer' });
    const id = startDisplayUpdate();
    setIntervalId(id);
    
    // Save the current state but don't reset totalStopTime
    chrome.storage.local.set({ 
      isRunning: true, 
      lastStopTime: null,
      totalStopTime: totalStopTime // Preserve the current totalStopTime
    });
  };

  const handleStop = () => {
    const now = Math.floor(new Date().getTime() / 1000);
    
    // Check if we've already reached the limit
    if (totalStopTime >= TOTAL_TIME_AVAILABLE) {
      setTotalStopTime(TOTAL_TIME_AVAILABLE);
      setLastStopTime(null);
      chrome.storage.local.set({ 
        isRunning: false,
        totalStopTime: TOTAL_TIME_AVAILABLE,
        lastStopTime: null
      });
      return;
    }
    
    // Initialize firstStartTime if it hasn't been set yet
    if (!firstStartTime) {
      setFirstStartTime(now);
      chrome.storage.local.set({ firstStartTime: now });
    }
    
    // Always set isRunning to false and update lastStopTime
    setIsRunning(false);
    setLastStopTime(now);
    
    // Only send stopTimer message if timer was actually running
    if (isRunning) {
      chrome.runtime.sendMessage({ action: 'stopTimer' });
    }
    
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    if (stopUpdateInterval) {
      clearInterval(stopUpdateInterval);
      setStopUpdateInterval(null);
    }

    const newStopInterval = setInterval(() => {
      setTotalStopTime(prevTotal => {
        if (prevTotal >= TOTAL_TIME_AVAILABLE) {
          clearInterval(newStopInterval);
          setStopUpdateInterval(null);
          chrome.storage.local.set({ 
            totalStopTime: TOTAL_TIME_AVAILABLE,
            lastStopTime: null
          });
          return TOTAL_TIME_AVAILABLE;
        }
        return prevTotal + 1;
      });
    }, 1000);
    
    setStopUpdateInterval(newStopInterval);
    
    chrome.storage.local.set({ 
      isRunning: false,
      lastStopTime: now,
      firstStartTime: firstStartTime || now
    });
  };

  const handleReset = () => {
    // First stop any running timers
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    // Clear any existing stop update interval
    if (stopUpdateInterval) {
      clearInterval(stopUpdateInterval);
      setStopUpdateInterval(null);
    }
    
    // Reset all states directly without calling handleStop
    setIsRunning(false);
    setTimeLeft(TOTAL_TIME);
    setFirstStartTime(null);
    setTotalStopTime(0);
    setLastStopTime(null);
    
    // Reset all storage values
    chrome.storage.local.set({ 
      timeLeft: TOTAL_TIME, 
      isRunning: false,
      firstStartTime: null,
      totalStopTime: 0,
      lastStopTime: null
    });
  };

  const getChartData = () => {
    return [
      {
        name: 'Time',
        remaining: timeLeft,  // / 3600, // Convert seconds to hours
        passed: TOTAL_TIME - timeLeft
      }
    ];
  };

  const getStopData = () => {
    if (!firstStartTime) return 0;
    const now = Math.floor(new Date().getTime() / 1000); // Convert to seconds
    const currentStopTime = lastStopTime ? (now - lastStopTime) : 0;
    return [
      {
        name: 'Time',
        value: totalStopTime ,
        // remaining: 86400 - totalStopTime
        remaining: TOTAL_TIME_AVAILABLE - totalStopTime
      }
    ];
  };

  return (
    <div style={{ alignContent: 'center' }}>
      
      {/* <div className="timer-display">{formatTime(timeLeft)}</div> */}

      <div style={{ 
      overflow:'hidden', 
      fontFamily: 'Comic Sans MS', 
      fontSize: '14px',
      marginBottom: '10px',
      marginTop: '5px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      position: 'relative'
    }}>
    Improve your productivity by working four hours every day. No excuses.

</div>


      
      {/* <div className="timer-display">{formatTime(timeLeft)}</div> */}

      <div style={{ 
      overflow:'hidden', 
      fontFamily: 'Comic Sans MS', 
      fontSize: '14px',
      marginBottom: '10px',
      marginTop: '5px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      position: 'relative'
    }}>
    <a href="https://waitbutwhy.com/2013/10/why-procrastinators-procrastinate.html" target="_blank" rel="noopener noreferrer" style={{color: '#4a90e2', textDecoration: 'underline'}}>
      Why Procrastinators Procrastiante
    </a>
      </div>

      <div className="button-container">
        <button onClick={handleStart} disabled={isRunning}>Work</button>
        <button onClick={handleStop}>Procrastinate</button>
        <button onClick={handleReset}>Reset</button>
      </div>

<div className="chart-container" style={{ display: 'flex', gap: '5px', alignContent: 'center' }}>

<div className="bg-white shadow-lg rounded-lg overflow-hidden w-full max-w-md mx-auto">
  <div className="p-6 flex flex-col items-center">

  <div style={{ 
      overflow:'hidden', 
      fontFamily: 'Comic Sans MS', 
      fontSize: '14px',
      marginBottom: '10px',
      marginTop: '5px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      position: 'relative'
    }}>
    time working from {formatTime(TOTAL_TIME)} hours
  </div>
    

    <div className="h-64 w-full mb-4">
      <ResponsiveContainer width={120} height={200} >
        <BarChart
          layout="horizontal"
          data={getChartData()}
          margin={{ top: 5, right: 5, bottom: 5, left: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="category" hide dataKey="name" />
          <YAxis type="number" hide tick={false} />

          <Bar dataKey="remaining" fill="#4CAF50" stackId="a" >
            <LabelList dataKey="remaining" position="insideTop" fill="#000" style={{ fontFamily: 'Comic Sans MS' }} formatter={(value) => formatTime(value)} />
          </Bar>


          <Bar dataKey="passed" fill="#4a90e2" stackId="a">
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    {/* Image */}
    <div style={{ width: '100px', height: '100px', overflow:'hidden' }}>
      <img
        src="icons/bar_rd.png"
        alt="Placeholder image"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  </div>
</div>

<div className="bg-white shadow-lg rounded-lg overflow-hidden w-full max-w-md mx-auto">
  <div className="p-6 flex flex-col items-center">

    {/* <div style={{ overflow:'hidden', fontFamily: 'Comic Sans MS', fontSize: '14px' }}>
      This is your time procrastinating
    </div>
     */}
    <div style={{ 
      overflow:'hidden', 
      fontFamily: 'Comic Sans MS', 
      fontSize: '14px',
      marginBottom: '10px',
      marginTop: '5px'
    }}>
      time procrastinating from {formatTime(TOTAL_TIME_AVAILABLE)} hours
    </div>
    
    <div className="h-64 w-full mb-4">
      <ResponsiveContainer width={120} height={200} >
        <BarChart
          layout="horizontal"
          data={getStopData()}
          margin={{ top: 5, right: 5, bottom: 5, left: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="category" hide dataKey="name" />
          <YAxis type="number" hide tick={false} />

          <Bar dataKey="value" fill="#FF0000" stackId="a">
            <LabelList 
              dataKey="value"
              position="insideTop"
              fill="#000"
              style={{ fontFamily: 'Comic Sans MS' }}
              formatter={(value) => formatTime(value)}
              offset={10}
            />
          </Bar>

          <Bar dataKey="remaining" fill="#4a90e2" stackId="a">
          <LabelList 
              dataKey="remaining"
              position="insideTop"
              fill="#000"
              style={{ fontFamily: 'Comic Sans MS' }}
              formatter={(value) => formatTime(value)}
              offset={10}
            />

          </Bar>

        </BarChart>
      </ResponsiveContainer>
    </div>
    {/* Image */}
    <div style={{ width: '100px', height: '100px', overflow:'hidden' }}>
      <img
        src="icons/bar_im.png"
        alt="Placeholder image"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  </div>
</div>

</div>


</div>
  );
}

export default Popup;
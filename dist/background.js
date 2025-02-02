/******/ (() => { // webpackBootstrap
/*!**************************************!*\
  !*** ./src/background/background.js ***!
  \**************************************/
var timerRunning = false;
function updateTimer() {
  chrome.storage.local.get(['timeLeft', 'isRunning'], function (result) {
    if (result.isRunning && result.timeLeft > 0) {
      var newTime = result.timeLeft - 1;
      chrome.storage.local.set({
        timeLeft: newTime
      });
    }
  });
}
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === 'timerTick') {
    updateTimer();
  }
});
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startTimer') {
    timerRunning = true;
    chrome.alarms.create('timerTick', {
      periodInMinutes: 1 / 60
    }); // Run every second
    chrome.storage.local.set({
      isRunning: true
    }); // Ensure isRunning is set in storage
    updateTimer(); // Start immediately
  } else if (message.action === 'stopTimer') {
    timerRunning = false;
    chrome.alarms.clear('timerTick');
    chrome.storage.local.set({
      isRunning: false
    }); // Ensure isRunning is updated in storage
  }
});

// Initialize alarm if timer was running before
chrome.storage.local.get(['isRunning', 'timeLeft'], function (result) {
  if (result.isRunning) {
    timerRunning = true;
    chrome.alarms.create('timerTick', {
      periodInMinutes: 1 / 60
    });
  }
  // Initialize timeLeft if not set
  if (result.timeLeft === undefined) {
    // chrome.storage.local.set({ timeLeft: 4 * 60 * 60 });
    chrome.storage.local.set({
      timeLeft: 100
    });
  }
});
/******/ })()
;
//# sourceMappingURL=background.js.map
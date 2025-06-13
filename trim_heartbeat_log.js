#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to load configuration from JSON file
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error: Configuration file not found or invalid');
    process.exit(1);
  }
}

// Main function
function trimHeartbeatLog() {
  // Load configuration
  const config = loadConfig();
  
  const logFile = config.heartbeat_log;
  const daysToKeep = config.log_days_to_keep;
  const tempFile = `${logFile}.tmp`;
  
  // Validate that log file exists
  if (!fs.existsSync(logFile)) {
    console.log(`Warning: Log file ${logFile} does not exist`);
    return;
  }
  
  // Calculate cutoff date (daysToKeep days ago in milliseconds since epoch)
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffTimestamp = cutoffDate.getTime();
  
  // Read the log file
  const lines = fs.readFileSync(logFile, 'utf8').split('\n');
  
  // Initialize variables
  let currentTimestamp = '';
  let currentTimestampMs = 0;
  let keepCurrentBlock = false;
  let output = [];
  
  // Process the log file line by line
  for (const line of lines) {
    // Regular expression to match timestamp format in log
    const match = line.match(/at\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+UTC/);
    
    if (match) {
      // Found a line with timestamp
      currentTimestamp = match[1];
      
      try {
        // Parse the timestamp to milliseconds
        currentTimestampMs = new Date(`${currentTimestamp} UTC`).getTime();
        
        // Determine if this entry is newer than the cutoff date
        if (currentTimestampMs >= cutoffTimestamp) {
          keepCurrentBlock = true;
          output.push(line);
        } else {
          keepCurrentBlock = false;
        }
      } catch (e) {
        // Error handling for invalid dates
        currentTimestampMs = 0;
        keepCurrentBlock = false;
      }
    } else {
      // Line without timestamp - keep it only if it belongs to a recent entry
      if (keepCurrentBlock) {
        output.push(line);
      }
    }
  }
  
  // Add maintenance log entry
  const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);
  output.push(`Heartbeat log maintenance successful at ${formattedDate} UTC`);
  output.push(`Removed entries older than ${daysToKeep} days`);
  
  // Write the trimmed content back to the log file
  fs.writeFileSync(tempFile, output.join('\n'), 'utf8');
  fs.renameSync(tempFile, logFile);
}

// Run the main function
trimHeartbeatLog();

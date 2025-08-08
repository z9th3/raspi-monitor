#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Convert exec to Promise-based
const execAsync = promisify(exec);

// Load configuration
function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading configuration file:', error.message);
    console.error('Make sure config.json exists in the same directory as this script');
    process.exit(1);
  }
}

const CONFIG = loadConfig();

// Extract configuration values
const GITHUB_REPO = CONFIG.github.repo;
const TIMESTAMP_FILE = CONFIG.timestamp_file;
const ERROR_LOGS_DIR = CONFIG.error_monitoring.log_dir;
const ERROR_LOG_PATTERN = new RegExp(CONFIG.error_monitoring.log_file_pattern);
const HTTP_TIMEOUT = CONFIG.default_http_timeout;

// Read github Personal Access Token from config file
const GITHUB_TOKEN = (() => {
  try {
    const configPath = path.join(__dirname, CONFIG.github.token_file);
    return fs.readFileSync(configPath, 'utf8').trim();
  } catch (error) {
    console.error('Error reading GitHub token from config file:', error.message);
    console.error(`Make sure to create a ${CONFIG.github.token_file} file with your token`);
    process.exit(1);
  }
})();

/**
 * Make HTTPS requests with Promise support
 * @param {Object} options - Request options
 * @param {String} [data] - POST/PUT data
 * @returns {Promise<Object>} - Response data
 */
function httpsRequest(options, data = null) {

  // Force no keep-alive to reduce ECONNRESET on some networks
  const agent = new https.Agent({ keepAlive: false });

  // Compute a valid timeout value
  const timeoutMs =
    typeof options.timeout === 'number' && Number.isFinite(options.timeout)
      ? options.timeout
      : HTTP_TIMEOUT;

  return new Promise((resolve, reject) => {
    const req = https.request(
    {
      ...options,
      agent
    },
    (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('aborted', () => {
          reject(new Error('Response aborted'));
        });
      
      res.on('end', () => {
          try {
            // Try to parse JSON; if not JSON, return raw string
            let parsedData = {};
            if (responseData) {
              try {
                parsedData = JSON.parse(responseData);
              } catch {
                parsedData = { raw: responseData };
              }
            }
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: parsedData
            });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      }
    );

    // Ensure a numeric timeout is always provided
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      const body = typeof data === 'string' ? data : JSON.stringify(data);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(body));
      req.write(body);
    }

    req.end();
  });
}

/**
 * Get external IP address
 * @returns {Promise<String>} - External IP address
 */
async function getExternalIp() {
  // Try a few endpoints with a short timeout each; never throw
  const candidates = [
    { hostname: 'api.ipify.org', path: '/', port: 443 },
    { hostname: 'ifconfig.me', path: '/ip', port: 443 }
  ];

  for (const c of candidates) {
    try {
      const ip = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: c.hostname,
            port: c.port,
            path: c.path,
            method: 'GET',
            timeout: 5000
          },
          (res) => {
            let rawData = '';
            res.on('data', (chunk) => (rawData += chunk));
            res.on('end', () => resolve(rawData.trim()));
          }
        );

        // Timeout and error handling: resolve gracefully
        req.setTimeout(5000, () => {
          req.destroy(new Error('Timeout'));
        });
        req.on('error', (err) => reject(err));
        req.end();
      });

      if (ip) return ip;
    } catch (err) {
      console.warn(`External IP lookup failed via ${c.hostname}: ${err.message}`);
    }
  }

  // Final fallback: never reject
  return 'Unable to determine';
}

/**
 * Get CPU temperature
 * @returns {Promise<Number>} - CPU temperature in Celsius
 */
async function getCpuTemperature() {
  try {
    const data = await fs.promises.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    return (parseInt(data) / 1000).toFixed(1);
  } catch (error) {
    console.error('Failed to get CPU temperature:', error.message);
    return 0;
  }
}

/**
 * Get system uptime information
 * @returns {Promise<String>} - Uptime information
 */
async function getUptime() {
  try {
    const { stdout } = await execAsync('uptime');
    return stdout.trim();
  } catch (error) {
    console.error('Failed to get uptime:', error.message);
    return "Unable to determine";
  }
}

/**
 * Get disk usage information
 * @returns {Promise<Number>} - Disk usage percentage
 */
async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df / --output=used,size');
    const lines = stdout.trim().split('\n');
    const [used, size] = lines[1].trim().split(/\s+/).map(Number);
    return ((used / size) * 100).toFixed(2);
  } catch (error) {
    console.error('Failed to get disk usage:', error.message);
    return 0;
  }
}

/**
 * Check for the latest error log and its status
 * @returns {Promise<Object>} - Error log information
 */
async function checkErrorLog() {
  try {
    // Read the log directory
    const files = await fs.promises.readdir(ERROR_LOGS_DIR);
    
    // Filter files that match the error log pattern
    const errorLogFiles = files.filter(file => ERROR_LOG_PATTERN.test(file));
    
    if (errorLogFiles.length === 0) {
      return {
        has_error: false,
        message: "No error logs found",
        latest_log: null,
        log_content: null
      };
    }
    
    // Sort files by date (newest first)
    errorLogFiles.sort((a, b) => {
      const dateA = a.match(ERROR_LOG_PATTERN);
      const dateB = b.match(ERROR_LOG_PATTERN);
      if (dateA && dateB) {
        const fullDateA = `${dateA[1]}-${dateA[2]}-${dateA[3]}`;
        const fullDateB = `${dateB[1]}-${dateB[2]}-${dateB[3]}`;
        return fullDateB.localeCompare(fullDateA);
      }
      return 0;
    });
    
    // Get the latest log file
    const latestLogFile = errorLogFiles[0];
    const logPath = path.join(ERROR_LOGS_DIR, latestLogFile);
    
    // Check if the file has content
    const stats = await fs.promises.stat(logPath);
    const fileSize = stats.size;
    
    // Read a preview of the log content (first 500 chars)
    let logContent = '';
    if (fileSize > 0) {
      const buffer = Buffer.alloc(Math.min(500, fileSize));
      const fileHandle = await fs.promises.open(logPath, 'r');
      await fileHandle.read(buffer, 0, buffer.length, 0);
      await fileHandle.close();
      logContent = buffer.toString('utf8');
      
      // Add ellipsis if the content was truncated
      if (fileSize > 500) {
        logContent += '...';
      }
    }
    
    return {
      has_error: fileSize > 0,
      message: fileSize > 0 ? `Error log contains ${fileSize} bytes` : "Error log is empty",
      latest_log: latestLogFile,
      log_content: fileSize > 0 ? logContent : null
    };
  } catch (error) {
    console.error('Failed to check error logs:', error.message);
    return {
      has_error: false,
      message: `Error checking logs: ${error.message}`,
      latest_log: null,
      log_content: null
    };
  }
}

/**
 * Collect system information
 * @returns {Promise<Object>} - System information
 */
async function getSystemInfo() {
  // Get memory information
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(2);
  
  // Get external IP
  const externalIp = await getExternalIp();
  
  // Get uptime
  const uptime = await getUptime();
  
  // Get disk usage
  const diskUsage = await getDiskUsage();
  
  // Get CPU temperature
  const cpuTemp = await getCpuTemperature();
  
  // Check error logs
  const errorLogStatus = await checkErrorLog();
  
  return {
    hostname: os.hostname(),
    external_ip: externalIp,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    uptime: uptime,
    memory_usage: `${memUsage}%`,
    disk_usage: `${diskUsage}%`,
    cpu_temp: `${cpuTemp}°C`,
    error_log: errorLogStatus
  };
}

/**
 * Update the heartbeat file in GitHub repository
 * @param {Object} fileContent - Content to write to file
 * @returns {Promise<Boolean>} - Success status
 */
async function updateGithubFile(fileContent) {
  try {
    // GitHub API endpoint for the file
    const apiUrl = `/repos/${GITHUB_REPO}/contents/${TIMESTAMP_FILE}`;
    
    // Common request options
    const requestOptions = {
      hostname: 'api.github.com',
      port: 443,
      path: apiUrl,
      method: 'GET',
      headers: {
        'User-Agent': 'Raspberry-Pi-Heartbeat',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    // Get the current file (if it exists) to get its SHA
    let sha = null;
    try {
      const response = await httpsRequest(requestOptions);
      if (response.statusCode === 200) {
        sha = response.data.sha;
      }
    } catch (error) {
      // File doesn't exist, which is fine for initial creation
      console.log('File does not exist yet, will create it');
    }
    
    // Prepare the content
    const content = Buffer.from(JSON.stringify(fileContent, null, 2)).toString('base64');
    
    // Update or create the file
    requestOptions.method = 'PUT';
    const updateData = {
      message: sha ? 'Update heartbeat status' : 'Create heartbeat status file',
      content: content,
      encoding: 'base64'
    };
    
    if (sha) {
      updateData.sha = sha;
    }
    
    const updateResponse = await httpsRequest(requestOptions, updateData);
    return updateResponse.statusCode === 200 || updateResponse.statusCode === 201;
  } catch (error) {
    console.error('Failed to update GitHub file:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const systemInfo = await getSystemInfo();

    // Retry up to 2 times on failure with backoff
    let success = false;
    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
      success = await updateGithubFile(systemInfo);
      if (success) break;
      const backoffMs = i * 2000; // 2s, 4s
      console.warn(`GitHub update failed (attempt ${i}/${attempts}). Retrying in ${backoffMs} ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    const statusMessage = success ? 'successful' : 'failed';
    console.log(`Heartbeat update ${statusMessage} at ${systemInfo.timestamp} UTC`);

    if (!success) {
      console.error('Failed to update GitHub file. Check your token and network connection.');
    }
  } catch (error) {
    console.error('Error in heartbeat process:', error);
  }
}

// Run the main function
main();

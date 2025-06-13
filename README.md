# Raspberry Pi Heartbeat Monitor

A lightweight, reliable system for monitoring Raspberry Pi uptime and system health remotely through GitHub. Automatically detect if your Raspberry Pi goes offline and receive email alerts.

![Raspberry Pi Monitoring](https://img.shields.io/badge/Raspberry%20Pi-Monitoring-c51a4a) ![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-2088FF)

## 📌 Overview

This project provides a complete solution for monitoring your Raspberry Pi's health and uptime by:

1. Regularly sending "heartbeat" signals from the Pi to GitHub
2. Tracking system metrics (temperature, memory usage, disk space)
3. Checking for offline status through GitHub Actions
4. Sending email alerts if issues are detected
5. Maintaining a monitoring history

## 🚀 Features

- **No special network configuration needed**: Works behind firewalls, NAT, with dynamic IPs, requires only outbound HTTPS, and does not expose your Pi to the Internet.
- **Regular System Reporting**: Sends heartbeat status at configurable intervals (every 2 hours by default)
- **System Metrics**: Tracks CPU temperature, memory usage, disk usage, uptime, and external IP
- **Error Log Monitoring**: Detects errors in specified log directories
- **Automated Alerts**: Sends email notifications when Pi goes offline or errors are found
- **Monitoring History**: Maintains a log of all checks in GitHub repository
- **Low Overhead**: Minimal resource usage on the Raspberry Pi, no external dependencies
- **Log Management**: Automatically trims logs to prevent excessive file growth
- **Configuration-Driven**: All settings managed through a single JSON configuration file
- **Network Flexible**: Works behind NAT, firewalls, and with changing IP addresses
- **Zero Infrastructure**: No additional servers, databases, or services required

## 🔧 Setup & Installation

### Step 1: Create Your Own GitHub Repository

Since this project uses GitHub Actions for monitoring, you'll need to create your own repository:

1. **Fork or Download this repository**:
   - **Option A (Recommended)**: Fork this repository to your GitHub account by clicking the "Fork" button
   - **Option B**: Download the code and create a new repository manually

2. **If you chose Option B (manual setup)**:
   ```bash
   # Download/clone the original repository
   git clone https://github.com/dm-yeu/yeu-raspi-monitor.git
   cd yeu-raspi-monitor

   # Remove the original git history
   rm -rf .git

   # Initialize your own git repository
   git init
   git add .
   git commit -m "Initial commit"

   # Create a new repository on GitHub (via web interface)
   # Then add your repository as the remote origin
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

3. **Configure your new repository**:
   - Go to your repository **Settings** > **Actions** > **General**
   - Under "Workflow permissions", select "Read and write permissions"
   - This allows GitHub Actions to create/update monitoring files

### Step 2: Set Up on the Raspberry Pi

1. **Clone your repository** (not the original):
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

2. **Set up the necessary dependencies**:
   ```bash
   # Make sure Node.js is installed
   sudo apt update
   sudo apt install nodejs npm
   ```

3. **Configure the system**:

   **Create the configuration file**:
   ```bash
   cp config.example.json config.json
   ```

   **Edit the configuration file** (`config.json`) with your specific settings:
   ```json
   {
     "heartbeat_log": "/path/to/this/project/logs/heartbeat.log",
     "log_days_to_keep": 30,
     "timestamp_file": "heartbeat.json",
     "github": {
       "repo": "YOUR_USERNAME/YOUR_REPO_NAME",
       "token_file": ".github-token"
     },
     "error_monitoring": {
       "log_dir": "/path/to/errorlogs/to/monitor/",
       "log_file_pattern": "^my_script_(\\d{4})-(\\d{2})-(\\d{2})_error\\.log$"
     }
   }
   ```

   **Create a GitHub Personal Access Token**:
   - Go to GitHub **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
   - Click "Generate new token (classic)"
   - Give it a descriptive name like "Raspberry Pi Monitor"
   - Set expiration as needed (or "No expiration" for convenience)
   - Select scopes: **repo** (Full control of private repositories)
   - Click "Generate token" and copy the token

   **Create the GitHub token file**:
   ```bash
   echo "your_github_personal_access_token_here" > .github-token
   chmod 600 .github-token
   ```

4. **Customize the configuration**:
   - Update `heartbeat_log` with the full path to where you want logs stored
   - Change `github.repo` to match your repository name (format: `YOUR_USERNAME/YOUR_REPO_NAME`)
   - Modify `error_monitoring.log_dir` to point to your application's log directory
   - Adjust `error_monitoring.log_file_pattern` to match your log file naming convention
   - Set `log_days_to_keep` to your preferred log retention period

5. **Create the logs directory**:
   ```bash
   mkdir -p logs
   ```

6. **Make the scripts executable**:
   ```bash
   chmod +x raspberry_heartbeat.js
   chmod +x trim_heartbeat_log.js
   ```

7. **Set up cron jobs** to run the scripts regularly:
   ```bash
   crontab -e
   ```
   Add these lines (replace `/path/to/this/project` with your actual project path):
   ```
   # Run the heartbeat script every 2 hours
   0 */2 * * * node /path/to/this/project/raspberry_heartbeat.js >> /path/to/this/project/logs/heartbeat.log 2>&1

   # Trim the log file to keep only the configured number of days (runs daily at midnight)
   0 0 * * * node /path/to/this/project/trim_heartbeat_log.js >> /path/to/this/project/logs/heartbeat.log 2>&1
   ```

### Step 3: Configure GitHub Actions & Notifications

1. **Configure Action secrets** in your repository:
   - Go to your repository **Settings** > **Secrets and variables** > **Actions**
   - Add the following secrets:
     - `SENDGRID_API_KEY`: Your SendGrid API key for sending emails
     - `NOTIFICATION_EMAIL`: The email address to receive alerts

2. **Set up SendGrid (for email notifications)**:
   - Sign up for a free SendGrid account at https://sendgrid.com/
   - Create an API key with "Mail Send" permissions
   - Add the API key to your GitHub repository secrets

3. **Test the setup**:
   - Run the heartbeat script manually: `node raspberry_heartbeat.js`
   - Check that a `heartbeat.json` file appears in your GitHub repository
   - Manually trigger the GitHub Actions workflow to test notifications

## ⚙️ Configuration Reference

All configuration is managed through the `config.json` file. Use `config.example.json` as a starting template.

### Configuration Options

| Field | Description | Example |
|-------|-------------|---------|
| `heartbeat_log` | Full path to the heartbeat log file | `"/home/pi/raspi-monitor/logs/heartbeat.log"` |
| `log_days_to_keep` | Number of days to retain in log files | `30` |
| `timestamp_file` | Name of the heartbeat file in GitHub | `"heartbeat.json"` |
| `github.repo` | Your GitHub repository (owner/repo format) | `"username/raspi-monitor"` |
| `github.token_file` | Path to GitHub token file (relative to project) | `".github-token"` |
| `error_monitoring.log_dir` | Directory to monitor for error logs | `"/var/log/myapp/"` |
| `error_monitoring.log_file_pattern` | Regex pattern for error log files | `"^app_(\\d{4})-(\\d{2})-(\\d{2})_error\\.log$"` |

### Configuration Examples

**Basic Home Setup:**
```json
{
  "heartbeat_log": "/home/pi/raspi-monitor/logs/heartbeat.log",
  "log_days_to_keep": 30,
  "timestamp_file": "heartbeat.json",
  "github": {
    "repo": "username/raspi-monitor",
    "token_file": ".github-token"
  },
  "error_monitoring": {
    "log_dir": "/home/pi/myapp/logs/",
    "log_file_pattern": "^error_(\\d{4})-(\\d{2})-(\\d{2})\\.log$"
  }
}
```

**Custom Application Monitoring:**
```json
{
  "heartbeat_log": "/opt/monitoring/logs/heartbeat.log",
  "log_days_to_keep": 7,
  "timestamp_file": "pi-status.json",
  "github": {
    "repo": "myorg/server-monitoring",
    "token_file": "/opt/monitoring/.secrets/github-token"
  },
  "error_monitoring": {
    "log_dir": "/var/log/myservice/",
    "log_file_pattern": "^service_error_(\\d{4})(\\d{2})(\\d{2})\\.log$"
  }
}
```

**Development Environment:**
```json
{
  "heartbeat_log": "/home/developer/projects/raspi-monitor/logs/heartbeat.log",
  "log_days_to_keep": 14,
  "timestamp_file": "dev-heartbeat.json",
  "github": {
    "repo": "developer/raspi-monitor-dev",
    "token_file": ".github-token"
  },
  "error_monitoring": {
    "log_dir": "/home/developer/app/logs/",
    "log_file_pattern": "^dev_error_(\\d{4})-(\\d{2})-(\\d{2})\\.log$"
  }
}
```

## 📊 How It Works

### Heartbeat Mechanism

1. **Raspberry Pi Side**:
   - The `raspberry_heartbeat.js` script reads configuration from `config.json`
   - Collects system information and checks for error logs
   - Updates the configured timestamp file in your GitHub repository
   - Runs every 2 hours via cron job
   - Logs all activity to the configured heartbeat log file

2. **GitHub Actions Side**:
   - The workflow in `.github/workflows/monitor-heartbeat.yml` runs multiple times a day
   - Checks if the timestamp file has been recently updated
   - If the heartbeat is missing or outdated, or if there is an error in specified log files, sends an alert email
   - Maintains monitoring history in `.github/monitor-history/check-history.md`

### Log Management

The `trim_heartbeat_log.js` script reads configuration from `config.json` and:
- Keeps only log entries from the past `log_days_to_keep` days
- Runs daily at midnight
- Adds its own entry confirming maintenance completion

## 📋 Files & Components

- `config.example.json`: **Example configuration file - copy this to `config.json`**
- `config.json`: **Your actual configuration file (not tracked by git)**
- `raspberry_heartbeat.js`: Collects and reports system information
- `.github/workflows/monitor-heartbeat.yml`: GitHub Actions workflow that checks the heartbeat
- `trim_heartbeat_log.js`: Script to manage log file size
- `.github-token`: GitHub Personal Access Token (create this file)
- `.github/monitor-history/check-history.md`: History of all monitoring checks (auto-generated)
- `heartbeat.json`: Current system status (auto-generated, name configurable)
- `logs/heartbeat.log`: Log of all heartbeat operations (path configurable)

### Security Configuration

This project requires a GitHub Personal Access Token. For security reasons, the token is stored in a separate file.

1. Create the token file as specified in `config.json` (default: `.github-token`)
2. Add your GitHub Personal Access Token to this file (single line, no quotes)
3. Set proper permissions: `chmod 600 .github-token`

Both the `config.json` and token files should be excluded from git through .gitignore to prevent accidental exposure of your system paths and credentials.

## 🔍 Monitoring Workflow

The GitHub Actions workflow runs at scheduled times (7:30, 13:30, 17:30 UTC) and:

1. Checks the timestamp in the configured timestamp file
2. Considers the Pi offline if no update in the last 3 hours
3. Sends email alerts for offline status
4. Also alerts if error logs are detected in the monitored directory
5. Updates the monitoring history

## 📝 Customization Options

### Monitoring Frequency

- To change how often the Pi sends a heartbeat:
  - Edit the crontab entry for `raspberry_heartbeat.js`
  - Default: Every 2 hours (`0 */2 * * *`)

- To change how often GitHub checks the heartbeat:
  - Edit the `cron` schedule in `.github/workflows/monitor-heartbeat.yml`
  - Default: Three times daily (`30 7,13,17 * * *`)

### Alert Thresholds

- To adjust how long before the Pi is considered offline:
  - Edit the `DIFF_HOURS` check in `.github/workflows/monitor-heartbeat.yml`
  - Default: 3 hours

### Log Retention

- To change how many days of logs to keep:
  - Edit `log_days_to_keep` in `config.json`
  - Default: 30 days

### Error Log Monitoring

- To monitor different log files:
  - Update `error_monitoring.log_dir` in `config.json`
  - Adjust `error_monitoring.log_file_pattern` to match your log file naming convention
  - The pattern uses regex format with escaped backslashes for the JSON file

## 🛠️ Troubleshooting

### Common Issues

1. **GitHub Actions not running**:
   - Make sure you created your own repository (not using the original)
   - Verify GitHub Actions are enabled in your repository settings
   - Check that workflow permissions are set to "Read and write permissions"

2. **Configuration file not found**:
   - Ensure you've copied `config.example.json` to `config.json`
   - Check that the JSON syntax is valid (no trailing commas)
   - Verify file permissions allow reading

3. **No heartbeat updates**:
   - Check the GitHub token file exists and has correct permissions
   - Verify the `github.repo` setting matches your repository exactly (YOUR_USERNAME/YOUR_REPO_NAME)
   - Verify the Pi has internet access
   - Check the configured heartbeat log file for errors

4. **Email alerts not working**:
   - Verify SendGrid API key is correct in GitHub secrets
   - Check GitHub Actions run logs for API errors
   - Make sure you added both `SENDGRID_API_KEY` and `NOTIFICATION_EMAIL` secrets

5. **Log file getting too large**:
   - Verify the `trim_heartbeat_log.js` cron job is running
   - Check the `log_days_to_keep` configuration value
   - Verify the heartbeat log path is correct in `config.json`

6. **Error monitoring not working**:
   - Check that `error_monitoring.log_dir` points to an existing directory
   - Verify the `error_monitoring.log_file_pattern` matches your log files
   - Test the regex pattern with your actual log file names

7. **Scripts can't find config.json**:
   - Ensure `config.json` is in the same directory as the scripts
   - Use absolute paths in your cron jobs

8. **Permission denied errors**:
   - Make sure the scripts are executable: `chmod +x *.js *.sh`
   - Check file permissions on config files and log directories

### Log Format

Heartbeat logs use this format:
```
Heartbeat update successful at YYYY-MM-DD HH:MM:SS UTC
```

Error messages that follow a timestamped entry are considered part of that entry for log trimming purposes.

### Configuration Validation

To test your configuration:

1. **Test the heartbeat script**:
   ```bash
   node raspberry_heartbeat.js
   ```

2. **Test the log trimming script**:
   ```bash
   node trim_heartbeat_log.js
   ```

3. **Verify configuration parsing**:
   ```bash
   node -e "console.log(JSON.stringify(require('./config.json'), null, 2))"
   ```

4. **Validate JSON syntax**:
   ```bash
   python3 -m json.tool config.json
   ```

5. **Test GitHub Actions manually**:
   - Go to your repository's "Actions" tab
   - Select "Monitor Raspberry Pi Heartbeat"
   - Click "Run workflow" to test manually

## 📜 License

This project is open-source - feel free to use and modify it for your needs.

## 👤 Author

Created by [dm-yeu](https://github.com/dm-yeu)

---

💡 **Tip**: After setup, you can manually trigger the GitHub Actions workflow by going to the "Actions" tab in your repository and selecting "Monitor Raspberry Pi Heartbeat", then clicking "Run workflow".

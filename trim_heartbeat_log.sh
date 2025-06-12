#!/bin/bash

# Function to load configuration from JSON file
load_config() {
    local config_file="$(dirname "$0")/config.json"
    
    if [[ ! -f "$config_file" ]]; then
        echo "Error: Configuration file $config_file not found"
        exit 1
    fi
    
    # Extract values using basic JSON parsing (no external dependencies)
    LOG_FILE=$(grep -o '"heartbeat_log"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" | sed 's/.*"heartbeat_log"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    DAYS_TO_KEEP=$(grep -o '"log_days_to_keep"[[:space:]]*:[[:space:]]*[0-9]*' "$config_file" | sed 's/.*"log_days_to_keep"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')
    
    # Validate that we got the values
    if [[ -z "$LOG_FILE" ]]; then
        echo "Error: Could not read heartbeat_log from configuration"
        exit 1
    fi
    
    if [[ -z "$DAYS_TO_KEEP" ]]; then
        echo "Error: Could not read log_days_to_keep from configuration"
        exit 1
    fi
}

# Load configuration
load_config

TEMP_FILE="${LOG_FILE}.tmp"

# Validate that log file exists
if [[ ! -f "$LOG_FILE" ]]; then
    echo "Warning: Log file $LOG_FILE does not exist"
    exit 0
fi

# Calculate cutoff date (DAYS_TO_KEEP days ago in seconds since epoch)
CUTOFF_DATE=$(date -d "now - ${DAYS_TO_KEEP} days" +%s)

# Create temp file
touch "$TEMP_FILE"

# Initialize variables
current_timestamp=""
current_timestamp_seconds=0
keep_current_block=false

# Process the log file line by line
while IFS= read -r line; do
    # Extract date part (format: "Heartbeat update X at YYYY-MM-DD HH:MM:SS UTC")
    if [[ $line =~ at\ ([0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2})\ UTC ]]; then
        # Found a line with timestamp
        current_timestamp="${BASH_REMATCH[1]}"
        # Parse the timestamp and handle potential errors
        current_timestamp_seconds=$(date -d "$current_timestamp" +%s 2>/dev/null) || current_timestamp_seconds=0
        
        # Determine if this entry is newer than the cutoff date (with error handling)
        if [ -n "$current_timestamp_seconds" ] && [ "$current_timestamp_seconds" -ge "$CUTOFF_DATE" ]; then
            keep_current_block=true
            echo "$line" >> "$TEMP_FILE"
        else
            keep_current_block=false
        fi
    else
        # Line without timestamp - keep it only if it belongs to a recent entry
        if [ "$keep_current_block" = true ]; then
            echo "$line" >> "$TEMP_FILE"
        fi
    fi
done < "$LOG_FILE"

# Replace original file with trimmed version
mv "$TEMP_FILE" "$LOG_FILE"

# Log the rotation completion in the same format as other log entries
echo "Heartbeat log maintenance successful at $(date '+%Y-%m-%d %H:%M:%S') UTC" >> "$LOG_FILE"
echo "Removed entries older than $DAYS_TO_KEEP days" >> "$LOG_FILE"

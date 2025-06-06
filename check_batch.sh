#\!/bin/bash
cd /Users/silasrhyneer/Code/heart-rush-tools
python batch_format_fix.py --check batch_6842a07d810881909d9bcd8b433e2283
if [ $? -eq 0 ]; then
    osascript -e "display notification \"Batch processing check completed. Check terminal for results.\" with title \"Heart Rush Batch Update\""
fi

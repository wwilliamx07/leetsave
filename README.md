# LeetSave

Automates solving the daily leetcode problem to protect your streak!
If the daily problem hasn't been solved 1 hour before the reset period, LeetSave automatically submits a solution on your behalf.

**Setup**

Create a `.env` file in the project root with the variables below.

- `cookie` — Your LeetCode session cookie string (find this through Network tab in developer tools).
- `google` — Google AI API key.
- `retry` — Number of retry attempts for submission (integer).
- `retry_interval` — Minutes between retries (integer). Matches `process.env.retry_interval` in code.
- `submit_lang` — LeetCode language slug to submit (e.g. `python3`, `cpp`, `java`). Matches `process.env.submit_lang`.
- `name` — LeetCode username.
- `webhook` — (optional) Discord or webhook URL to receive logs.
- `api_base` — api url

**Example .env**
cookie=entire_leetcode_cookie
google=YOUR_GOOGLE_API_KEY
retry=3
retry_interval=5
submit_lang=python3
name=your_leetcode_username
webhook=https://discord....
api_base=https://alfa-leetcode-api.onrender.com

This project utilizes https://github.com/alfaarghya/alfa-leetcode-api. Ensure api_base is either set to a locally hosted instance or the
public api endpoint
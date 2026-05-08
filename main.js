import {completeProblem, checkRecentlySolved} from "./util.js"
import "dotenv/config"
import cron from "node-cron"

const retryIntervalMs = parseInt(process.env.retry_interval) * 60 * 1000
const maxAttempts = parseInt(process.env.retry)
const lang = process.env.submit_lang
const webhook = process.env.webhook
const api_base = process.env.api_base

async function sendToWebhook(message) {
    if (!webhook) return
    try {
        await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message })
        })
    } catch (err) {
        console.log("Failed to send to webhook:", err)
    }
}

function log(out) {
    console.log(out)
    if (!webhook) return
    sendToWebhook(out)
}

async function solveDaily() {
    log("Solving daily problem...")

    try {
        const dailyResp = await fetch(`${api_base}/daily`)
        const dailyProblem = await dailyResp.json()
        const titleSlug = dailyProblem.titleSlug

        if (!titleSlug) {
            log("Couldn't determine today's titleSlug from daily API")
            return
        }

        const already = await checkRecentlySolved(titleSlug)
        if (already) {
            log(`Problem ${titleSlug} already solved recently; skipping.`)
            return
        }

        let attempts = 0
        async function attempt() {
            attempts += 1
            try {
                const res = await completeProblem(titleSlug, lang)
                log(`completeProblem result: ${res}`)

                if (res === 200) {
                    await new Promise(r => setTimeout(r, 30000))
                    const solvedNow = await checkRecentlySolved(titleSlug)
                    if (solvedNow) {
                        log("Daily completion successful")
                        return
                    }
                    log("Submission returned 200 but problem is not marked solved yet")
                } else {
                    log("Non-200 response: " + res)
                }
            } catch (err) {
                log(`Attempt ${attempts} failed`)
            }

            if (attempts < maxAttempts) {
                setTimeout(attempt, retryIntervalMs)
            } else {
                log("Max attempts reached. Giving up for today.")
            }
        }

        attempt()
    } catch (err) {
        log("Failed to fetch daily problem")
    }
}

cron.schedule("0 22 * * *", solveDaily, { timezone: "UTC" })
log("Started LeetSave")
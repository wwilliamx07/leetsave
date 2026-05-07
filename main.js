import {completeProblem, checkRecentlySolved} from "./util.js"
import "dotenv/config"
import cron from "node-cron"
import { inspect } from "util"

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

function formatLogArgs(args) {
    return args.map(a => (typeof a === 'string' ? a : inspect(a, { depth: 2 }))).join(' ')
}

function log(...args) {
    console.log(...args)
    if (!webhook) return
    const msg = formatLogArgs(args)
    sendToWebhook(msg).catch(() => {})
}

async function solveDaily() {
    log("Solving daily problem...")

    try {
        const dailyResp = await fetch(`${api_base}/daily`)
        const dailyProblem = await dailyResp.json()
        const titleSlug = dailyProblem.titleSlug

        if (!titleSlug) {
            console.error("Couldn't determine today's titleSlug from daily API")
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
                    const solvedNow = await checkRecentlySolved(titleSlug)
                    if (solvedNow) {
                        log("Daily completion successful")
                        return
                    }
                    throw new Error("Submission returned 200 but problem is not marked solved yet")
                }

                throw new Error("Non-200 response: " + res)
                } catch (err) {
                log(`Attempt ${attempts} failed:`, err)
                if (attempts < maxAttempts) {
                    setTimeout(attempt, retryIntervalMs)
                } else {
                    log("Max attempts reached. Giving up for today.")
                }
            }
        }

        attempt()
    } catch (err) {
        log("Failed to fetch daily problem:", err)
    }
}

cron.schedule("0 0 * * *", solveDaily, { timezone: "UTC" })
log("Started LeetSave")